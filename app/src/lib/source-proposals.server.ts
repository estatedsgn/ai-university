import type { D1Database } from "@cloudflare/workers-types";
import { allowLearningRate, getLearningIdentity } from "./learning-session.server";

type Env = { DB?: D1Database };
type Proposal = {
  id: string; title: string; institution: string; url: string;
  rights_note: string; status: "pending" | "approved" | "rejected"; created_at: number;
};
const BODY_LIMIT = 5_000;
function json(body: Record<string, unknown>, status = 200, cookie: string | null = null, extra: HeadersInit = {}): Response {
  const h = new Headers(extra);
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  h.set("X-Content-Type-Options", "nosniff");
  if (cookie) h.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers: h });
}
function field(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length >= min && s.length <= max && !/[\x00-\x1f\x7f]/.test(s) ? s : null;
}
async function readLimited(request: Request): Promise<Record<string, unknown> | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > BODY_LIMIT) { await reader.cancel(); return null; }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const x: unknown = JSON.parse(body);
    return x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
function safeHttpsLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    // We store the URL as inert text. No server-side fetch of user-controlled URLs.
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hostname.length > 253 ||
        !u.hostname.includes(".") || u.hostname === "localhost" || u.hostname.endsWith(".localhost")) return false;
    return true;
  } catch { return false; }
}

/** Public users may propose links, but only staff-controlled workflows can approve them. */
export async function handleSourceProposals(request: Request, envValue: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/sources/proposals") return null;
  if (request.method !== "POST" && request.method !== "GET")
    return json({ error: "Метод не поддерживается." }, 405, null, { Allow: "GET, POST" });
  const env = (envValue ?? {}) as Env;
  if (!env.DB) return json({ error: "Хранилище источников ещё не настроено." }, 503);
  if (request.headers.get("Origin") !== null && request.headers.get("Origin") !== url.origin)
    return json({ error: "Запрос из другого сайта запрещён." }, 403);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site")
    return json({ error: "Запрос из другого сайта запрещён." }, 403);
  const learner = await getLearningIdentity(request);
  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id,title,institution,url,rights_note,status,created_at FROM source_proposals WHERE owner_hash=? ORDER BY created_at DESC LIMIT 30"
      ).bind(learner.ownerHash).all<Proposal>();
      return json({ proposals: results ?? [] }, 200, learner.cookie);
    }
    if (request.headers.get("Origin") !== url.origin)
      return json({ error: "Отправляйте ссылку из формы сайта." }, 403);
    if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json")
      return json({ error: "Нужен JSON." }, 415);
    const data = await readLimited(request);
    if (!data) return json({ error: "Проверьте размер и формат заявки." }, 400);
    const title = field(data.title, 4, 180);
    const institution = field(data.institution, 2, 120);
    const link = field(data.url, 12, 1600);
    const rightsNote = field(data.rightsNote, 2, 350);
    if (!title || !institution || !link || !safeHttpsLink(link) || !rightsNote)
      return json({ error: "Нужны название, университет, HTTPS-ссылка и сведения о правах." }, 400);
    if (!await allowLearningRate(request, env.DB, "source-proposals", 5))
      return json({ error: "Сегодня лимит предложений исчерпан." }, 429);
    const id = crypto.randomUUID(), now = Date.now();
    await env.DB.prepare(
      "INSERT INTO source_proposals(id,owner_hash,title,institution,url,rights_note,status,created_at,reviewed_at) VALUES(?,?,?,?,?,?,'pending',?,NULL)"
    ).bind(id, learner.ownerHash, title, institution, link, rightsNote, now).run();
    return json({ ok: true, id, status: "pending", message: "Источник отправлен на проверку. Он ещё не опубликован." }, 201, learner.cookie);
  } catch {
    return json({ error: "Временно не удалось сохранить источник." }, 503);
  }
}
