import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { D1Database } from "@cloudflare/workers-types";
import { handleMaterials } from "./materials.server";
import type { AgentQuiz } from "./learning-types";

const SITE = "https://university.test";
const TOKEN = "organizer-token-for-tests-only";
const originalFetch = globalThis.fetch;
type Row = Record<string, unknown>;

class MemoryD1 {
  rows = new Map<string, Row>();
  rateAllowed = true;
  prepares = 0;
  prepare(sql: string) {
    this.prepares++;
    let values: unknown[] = [];
    const database = this;
    const statement = {
      bind(...args: unknown[]) { values = args; return statement; },
      async first() {
        if (/learning_rate_limits/i.test(sql)) return database.rateAllowed ? { attempts: 1 } : null;
        if (/SELECT .*FROM materials/i.test(sql)) return database.rows.get(String(values[0])) ?? null;
        return null;
      },
      async run() {
        if (/INSERT INTO materials/i.test(sql)) {
          const keys = ["id", "owner_hash", "title", "summary", "source_url", "track", "origin", "visibility", "questions_json", "created_at"];
          const row = Object.fromEntries(keys.map((key, index) => [key, values[index]]));
          database.rows.set(String(values[0]), row);
        }
        return { success: true, meta: {} };
      },
    };
    return statement;
  }
  asD1() { return this as unknown as D1Database; }
}

function quiz(): AgentQuiz {
  return {
    title: "Основы дробей",
    summary: "Черновик пяти вопросов по дробям. Преподавателю нужно проверить содержание.",
    questions: Array.from({ length: 5 }, (_, index) => ({
      prompt: "Какой результат у учебного примера номер " + (index + 1) + "?",
      options: ["Один", "Два", "Три", "Четыре"],
      correctIndex: index % 4,
      explanation: "Проверяем указанное в материале правило и получаем нужный результат.",
    })),
  };
}

function importRequest(body: unknown, headers: HeadersInit = {}, site = SITE): Request {
  const all = new Headers({ "Content-Type": "application/json", Origin: site });
  new Headers(headers).forEach((value, key) => all.set(key, value));
  return new Request(SITE + "/api/materials/import", {
    method: "POST", headers: all, body: JSON.stringify(body),
  });
}

function originlessRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request(SITE + "/api/materials/import", {
    method: "POST", headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(headers)) },
    body: JSON.stringify(body),
  });
}

function modelResponse(value: unknown = quiz()): Response {
  return Response.json({
    status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  });
}

describe("material import boundaries and private answers", () => {
  let db: MemoryD1;
  beforeEach(() => { db = new MemoryD1(); });
  afterEach(() => { globalThis.fetch = originalFetch; });

  test("unrelated requests pass through", async () => {
    expect(await handleMaterials(new Request(SITE + "/"), {})).toBeNull();
  });

  test("prepared agent quiz works without secrets and stores no public answers", async () => {
    const response = await handleMaterials(importRequest({ agentQuiz: quiz(), track: "math" }), { DB: db.asD1() });
    expect(response?.status).toBe(201);
    const body = await response!.json();
    expect(body.material.origin).toBe("agent");
    expect(body.material.reviewed).toBe(false);
    expect(body.material.visibility).toBe("private");
    expect(body.material.questionCount).toBe(5);
    expect(body.material).not.toHaveProperty("questions");
    expect(body.material).not.toHaveProperty("questions_json");
    expect(body.material).not.toHaveProperty("owner_hash");
    expect(body.material).not.toHaveProperty("text");
    const privateQuestions = JSON.parse(String(db.rows.get(body.material.id)!.questions_json));
    expect(privateQuestions[0].answer).toBe("Один");
    expect(privateQuestions.every((question: Row) => question.transfer === false)).toBe(true);
    expect(response!.headers.get("Set-Cookie")).toBeTruthy();
  });

  test("anonymous cross-origin or originless imports are rejected", async () => {
    const env = { DB: db.asD1() };
    expect((await handleMaterials(importRequest({ agentQuiz: quiz() }, {}, "https://other.test"), env))?.status).toBe(403);
    expect((await handleMaterials(originlessRequest({ agentQuiz: quiz() }), env))?.status).toBe(403);
    expect(db.rows.size).toBe(0);
  });

  test("paid import fails truthfully without server token or model key", async () => {
    const body = { text: "Учебный материал о дробях и арифметике. ".repeat(10) };
    expect((await handleMaterials(importRequest(body), { DB: db.asD1() }))?.status).toBe(503);
    const response = await handleMaterials(importRequest(body, { "X-Import-Token": TOKEN }), {
      DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN,
    });
    expect(response?.status).toBe(503);
    expect((await response!.json()).code).toBe("not_configured");
    expect(db.rows.size).toBe(0);
  });

  test("invalid token is neutral and cross-origin valid token still cannot import", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN, OPENAI_API_KEY: "fake-test-key" };
    const invalid = await handleMaterials(importRequest({ agentQuiz: quiz() }, { "X-Import-Token": "wrong" }), env);
    expect(invalid?.status).toBe(401);
    expect((await invalid!.json()).error).toBe("Токен импорта недействителен или истёк.");
    expect((await handleMaterials(importRequest({ agentQuiz: quiz() }, { "X-Import-Token": TOKEN }, "https://other.test"), env))?.status).toBe(403);
    expect((await handleMaterials(importRequest({ agentQuiz: quiz() }, { Authorization: "Bearer " + TOKEN, "X-Import-Token": TOKEN }), env))?.status).toBe(401);
  });

  test("external bearer agent can omit Origin but browser metadata cannot", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN };
    const body = { agentQuiz: quiz() };
    expect((await handleMaterials(originlessRequest(body, { Authorization: "Bearer " + TOKEN }), env))?.status).toBe(201);
    expect((await handleMaterials(originlessRequest(body, { Authorization: "Bearer " + TOKEN, "Sec-Fetch-Site": "same-origin" }), env))?.status).toBe(403);
    expect((await handleMaterials(originlessRequest(body, { "X-Import-Token": TOKEN }), env))?.status).toBe(403);
  });

  test("private metadata is owner-only and unlisted links omit solutions", async () => {
    const created = await handleMaterials(importRequest({ agentQuiz: quiz() }), { DB: db.asD1() });
    const { material } = await created!.json();
    const ownerCookie = created!.headers.get("Set-Cookie")!.split(";")[0];
    const owner = await handleMaterials(new Request(SITE + "/api/materials/" + material.id, { headers: { Cookie: ownerCookie } }), { DB: db.asD1() });
    expect(owner?.status).toBe(200);
    expect((await handleMaterials(new Request(SITE + "/api/materials/" + material.id), { DB: db.asD1() }))?.status).toBe(404);
    db.rows.get(material.id)!.visibility = "unlisted";
    const guest = await handleMaterials(new Request(SITE + "/api/materials/" + material.id), { DB: db.asD1() });
    expect(guest?.status).toBe(200);
    const serialized = await guest!.text();
    expect(serialized).not.toContain("correctIndex");
    expect(serialized).not.toContain("questions_json");
    expect(serialized).not.toContain("owner_hash");
    expect(serialized).not.toContain("Проверяем указанное");
  });

  test("quiz cardinality, duplicate options, answer index and extra fields are validated", async () => {
    const invalid: unknown[] = [];
    const short = quiz(); short.questions.pop(); invalid.push(short);
    const duplicate = quiz(); duplicate.questions[0].options[1] = " один "; invalid.push(duplicate);
    const answer = quiz(); answer.questions[0].correctIndex = 4; invalid.push(answer);
    const empty = quiz(); empty.questions[0].explanation = ""; invalid.push(empty);
    const repeated = quiz(); repeated.questions[1].prompt = repeated.questions[0].prompt; invalid.push(repeated);
    invalid.push({ ...quiz(), rawSource: "private" });
    for (const agentQuiz of invalid) {
      expect((await handleMaterials(importRequest({ agentQuiz }), { DB: db.asD1() }))?.status).toBe(400);
    }
    expect(db.rows.size).toBe(0);
  });

  test("body byte limit is enforced without Content-Length", async () => {
    const response = await handleMaterials(importRequest({ agentQuiz: quiz(), extra: "я".repeat(40_000) }), { DB: db.asD1() });
    expect(response?.status).toBe(413);
    expect(db.rows.size).toBe(0);
  });

  test("rate rejection prevents external fetches and writes", async () => {
    db.rateAllowed = false;
    let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error("should not fetch"); }) as typeof fetch;
    const response = await handleMaterials(importRequest({ agentQuiz: quiz() }), { DB: db.asD1() });
    expect(response?.status).toBe(429);
    expect(Number(response!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(calls).toBe(0);
    expect(db.rows.size).toBe(0);
  });

  test("HTTPS public education allowlist rejects dangerous and unsupported URLs before fetch", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN, OPENAI_API_KEY: "fake-test-key" };
    let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error("should not fetch"); }) as typeof fetch;
    for (const url of [
      "http://en.wikipedia.org/wiki/Math", "https://127.0.0.1/admin", "https://[::1]/",
      "https://en.wikipedia.org:444/wiki/Math", "https://user:pass@en.wikipedia.org/wiki/Math",
      "https://wikipedia.org.evil.test/", "https://example.com/page", "https://khanacademy.org.evil.test/",
    ]) {
      expect((await handleMaterials(importRequest({ url }, { "X-Import-Token": TOKEN }), env))?.status).toBe(400);
    }
    expect(calls).toBe(0);
  });

  test("redirect to local or unsupported destination is not followed", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN, OPENAI_API_KEY: "fake-test-key" };
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/private" } });
    }) as typeof fetch;
    const response = await handleMaterials(importRequest({ url: "https://en.wikipedia.org/wiki/Math" }, { "X-Import-Token": TOKEN }), env);
    expect(response?.status).toBe(400);
    expect(calls).toEqual(["https://en.wikipedia.org/wiki/Math"]);
  });

  test("redirect count, source media type and streamed bytes are bounded", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN, OPENAI_API_KEY: "fake-test-key" };
    const request = () => importRequest({ url: "https://en.wikipedia.org/wiki/Math" }, { "X-Import-Token": TOKEN });
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response(null, { status: 302, headers: { Location: "/wiki/Again" } }); }) as typeof fetch;
    expect((await handleMaterials(request(), env))?.status).toBe(422);
    expect(calls).toBe(4);
    globalThis.fetch = (async () => new Response("binary", { headers: { "Content-Type": "application/pdf" } })) as typeof fetch;
    expect((await handleMaterials(request(), env))?.status).toBe(422);
    globalThis.fetch = (async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(262_145)); controller.close(); },
    }), { headers: { "Content-Type": "text/plain" } })) as typeof fetch;
    expect((await handleMaterials(request(), env))?.status).toBe(413);
  });

  test("source is isolated as untrusted data, secrets are not forwarded, valid model response stores private answers", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN, OPENAI_API_KEY: "fake-test-key" };
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("api.openai.com")) return modelResponse();
      return new Response("<script>SECRET SCRIPT</script><style>SECRET STYLE</style><p>" + "Дробь обозначает часть целого. ".repeat(10) + "</p>", { headers: { "Content-Type": "text/html" } });
    }) as typeof fetch;
    const response = await handleMaterials(importRequest({ url: "https://en.wikipedia.org/wiki/Math?tracking=private", track: "math" }, { "X-Import-Token": TOKEN }), env);
    expect(response?.status).toBe(201);
    const result = await response!.json();
    expect(result.material.sourceUrl).toBe("https://en.wikipedia.org/wiki/Math");
    expect(result.material.origin).toBe("ai");
    expect(new Headers(calls[0].init?.headers).has("Authorization")).toBe(false);
    expect(calls[0].init?.redirect).toBe("manual");
    const upstream = JSON.parse(String(calls[1].init?.body));
    expect(upstream.store).toBe(false);
    expect(upstream.text.format.type).toBe("json_schema");
    expect(JSON.stringify(upstream.input)).toContain("untrustedEducationalSource");
    expect(JSON.stringify(upstream.input)).not.toContain("SECRET SCRIPT");
    expect(JSON.stringify(upstream.input)).not.toContain("SECRET STYLE");
    expect(new Headers(calls[1].init?.headers).get("Authorization")).toBe("Bearer fake-test-key");
  });

  test("invalid model output and upstream failures do not store drafts", async () => {
    const env = { DB: db.asD1(), MATERIAL_IMPORT_TOKEN: TOKEN, OPENAI_API_KEY: "fake-test-key" };
    const request = () => importRequest({ text: "Арифметика изучает числа и операции над ними. ".repeat(10) }, { "X-Import-Token": TOKEN });
    const malformed = quiz(); malformed.questions[0].correctIndex = 99;
    globalThis.fetch = (async () => modelResponse(malformed)) as typeof fetch;
    expect((await handleMaterials(request(), env))?.status).toBe(502);
    globalThis.fetch = (async () => new Response("do not leak provider secrets", { status: 429 })) as typeof fetch;
    const response = await handleMaterials(request(), env);
    expect(response?.status).toBe(502);
    expect(await response!.text()).not.toContain("provider secrets");
    expect(db.rows.size).toBe(0);
  });
});
