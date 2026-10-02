import type { D1Database } from "@cloudflare/workers-types";

const COOKIE_NAME = "aiu_learner";
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

/** Anonymous browser continuity only; not an authenticated or verified student identity. */
export async function getLearningIdentity(request: Request): Promise<{ ownerHash: string; cookie: string | null }> {
  const candidates = (request.headers.get("Cookie") ?? "").split(";")
    .map(part => part.trim()).filter(part => part.startsWith(COOKIE_NAME + "="));
  let id = candidates.length === 1 ? candidates[0].slice(COOKIE_NAME.length + 1) : "";
  let cookie: string | null = null;
  if (!/^[a-f0-9]{64}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    id = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    cookie = `${COOKIE_NAME}=${id}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000`;
  }
  return { ownerHash: await digest("ai-university:learner:" + id), cookie };
}

/** D1 atomic upsert prevents simultaneous requests from exceeding the infrastructure quota. */
export async function allowLearningRate(request: Request, db: D1Database, bucket: string, max: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unavailable";
  const ipHash = await digest(`ai-university:learning:${day}:${ip}`);
  const result = await db.prepare(
    `INSERT INTO learning_rate_limits (day, ip_hash, bucket, attempts)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(day, ip_hash, bucket) DO UPDATE SET attempts = attempts + 1
     WHERE attempts < ? RETURNING attempts`
  ).bind(day, ipHash, bucket, max).first<{ attempts: number }>();
  return result !== null;
}
