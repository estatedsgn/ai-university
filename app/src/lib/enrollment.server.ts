import type { D1Database } from "@cloudflare/workers-types";

type EnrollmentEnv = { DB?: D1Database; APP_SLUG?: string };
type Signup = {
  name: string;
  email: string;
  goal: string;
  minutes: 15 | 30 | 60;
  gamePercent: number;
  consent: true;
};

const MAX_BODY_BYTES = 8_192;
const MAX_DAILY_ATTEMPTS = 5;
const CONSENT_VERSION = "pilot-v1";

function json(body: Record<string, unknown>, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}

class BodyTooLarge extends Error {}

// Enforce the byte limit even when Content-Length is absent or incorrect.
async function readLimitedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function hasControlCharacters(value: string, allowLineBreaks = false): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && !(allowLineBreaks && [9, 10, 13].includes(code)));
  });
}

function validateSignup(value: Record<string, unknown>): Signup | null {
  if (
    typeof value.name !== "string" ||
    typeof value.email !== "string" ||
    typeof value.goal !== "string" ||
    value.consent !== true
  )
    return null;
  const name = value.name.trim();
  const email = value.email.trim().toLowerCase();
  const goal = value.goal.trim();
  if (
    name.length < 1 ||
    name.length > 100 ||
    hasControlCharacters(name) ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email) ||
    email.split("@")[0].length > 64 ||
    hasControlCharacters(email) ||
    goal.length < 3 ||
    goal.length > 1_000 ||
    hasControlCharacters(goal, true) ||
    ![15, 30, 60].includes(value.minutes as number) ||
    typeof value.gamePercent !== "number" ||
    !Number.isInteger(value.gamePercent) ||
    value.gamePercent < 0 ||
    value.gamePercent > 100
  )
    return null;
  return {
    name,
    email,
    goal,
    minutes: value.minutes as Signup["minutes"],
    gamePercent: value.gamePercent,
    consent: true,
  };
}

async function ipHash(request: Request, day: string, appSlug: string): Promise<string> {
  // Cloudflare supplies this header. Do not trust client-controlled X-Forwarded-For.
  // Avoid keeping a stable key for successive days; the hash is still a pseudonym.
  const ip = request.headers.get("CF-Connecting-IP") ?? "unavailable";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${appSlug}:${day}:${ip}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Handles only the private write endpoint; no unauthenticated participant-list API. */
export async function handleEnrollment(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/enrollment") return null;
  if (request.method !== "POST") {
    return json({ error: "Отправьте заявку через форму." }, 405, { Allow: "POST" });
  }
  if (
    request.headers.get("Origin") !== url.origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    return json({ error: "Откройте форму на сайте AI Университета." }, 403);
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") {
    return json({ error: "Форма должна отправить данные в формате JSON." }, 415);
  }
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return json({ error: "Заявка слишком большая." }, 413);
  }
  let value: unknown;
  try {
    value = JSON.parse(await readLimitedBody(request));
  } catch (error) {
    return json(
      {
        error:
          error instanceof BodyTooLarge ? "Заявка слишком большая." : "Проверьте форму заявки.",
      },
      error instanceof BodyTooLarge ? 413 : 400,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return json({ error: "Проверьте форму заявки." }, 400);
  }
  const body = value as Record<string, unknown>;
  if (body.website !== undefined && typeof body.website !== "string") {
    return json({ error: "Проверьте форму заявки." }, 400);
  }
  // A filled hidden field is a bot submission. Reveal nothing and store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") return json({ ok: true });
  const signup = validateSignup(body);
  if (!signup) {
    return json({ error: "Проверьте имя, email, цель и согласие на участие в тестировании." }, 400);
  }
  const { DB: db, APP_SLUG: appSlug } = (env ?? {}) as EnrollmentEnv;
  if (!db) return json({ error: "Форма временно недоступна. Попробуйте позже." }, 503);
  try {
    const day = new Date().toISOString().slice(0, 10);
    const hash = await ipHash(request, day, appSlug ?? "ai-university");
    // One atomic statement prevents concurrent requests from bypassing the limit.
    const attempt = await db
      .prepare(
        `INSERT INTO enrollment_rate_limits (day, ip_hash, attempts)
       VALUES (?, ?, 1)
       ON CONFLICT(day, ip_hash) DO UPDATE SET attempts = attempts + 1
       WHERE attempts < ? RETURNING attempts`,
      )
      .bind(day, hash, MAX_DAILY_ATTEMPTS)
      .first<{ attempts: number }>();
    if (!attempt) {
      const nextDay = new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000;
      const retryAfter = Math.max(1, Math.ceil((nextDay - Date.now()) / 1_000));
      return json({ error: "Лимит заявок на сегодня достигнут. Попробуйте завтра." }, 429, {
        "Retry-After": String(retryAfter),
      });
    }
    await db
      .prepare(
        `INSERT INTO enrollments
        (id, name, email, goal, minutes, game_percent, consent_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        signup.name,
        signup.email,
        signup.goal,
        signup.minutes,
        signup.gamePercent,
        CONSENT_VERSION,
      )
      .run();
    // Same response for new and existing email; preserve the original application.
    return json({ ok: true });
  } catch {
    // Avoid emitting contact details or database errors to logs or public responses.
    return json({ error: "Не удалось сохранить заявку. Попробуйте позже." }, 503);
  }
}
