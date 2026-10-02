import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { D1Database } from "@cloudflare/workers-types";
import { handleLearning, getLearningProgress } from "./learning.server";
import { getLearningIdentity, allowLearningRate } from "./learning-session.server";

const ORIGIN = "https://university.test";
let sqlite: Database;
let db: D1Database;
let cookie: string;

function adapter(sqlite: Database): D1Database {
  return {
    prepare(query: string) {
      const statement = (values: unknown[] = []) => ({
        bind: (...parameters: unknown[]) => statement(parameters),
        async first(column?: string) {
          const row = sqlite.query(query).get(...values as any[]) as Record<string, unknown> | null;
          return column && row ? row[column] : row;
        },
        async all() { return { success: true, results: sqlite.query(query).all(...values as any[]) }; },
        async run() {
          const result = sqlite.query(query).run(...values as any[]);
          return { success: true, meta: { changes: result.changes } };
        },
      });
      return statement();
    },
  } as unknown as D1Database;
}
async function call(path: string, method = "GET", body?: unknown, owner = cookie, extra: Record<string, string> = {}) {
  const headers = new Headers({ Cookie: owner, "CF-Connecting-IP": "192.0.2.7", ...extra });
  if (method === "POST") { headers.set("Origin", headers.get("Origin") ?? ORIGIN); headers.set("Content-Type", "application/json"); }
  const response = await handleLearning(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), { DB: db });
  if (!response) throw new Error("Route not handled");
  return { response, data: await response.json() as any };
}
async function start(topicId = "math-arithmetic", mode = "diagnostic", timed = false, owner = cookie) {
  const result = await call("/api/learning/assessments", "POST", { topicId, mode, timed }, owner);
  expect(result.response.status).toBe(201);
  return result.data.assessment;
}
function saved(id: string) {
  const row = sqlite.query("SELECT * FROM learning_attempts WHERE id=?").get(id) as any;
  return { row, state: JSON.parse(row.state_json) };
}
async function complete(assessment: any, correct = true, owner = cookie, reasoning = "") {
  while (!assessment.completed) {
    if (!assessment.question) {
      const next = await call("/api/learning/assessments/" + assessment.id + "/next", "POST", {}, owner);
      assessment = next.data.assessment;
    }
    const q = saved(assessment.id).state.questions.find((item: any) => item.id === assessment.question.id);
    const result = await call("/api/learning/answers", "POST", {
      assessmentId: assessment.id, questionId: q.id,
      answer: correct ? String(q.answer) : "definitely-wrong", reasoning,
      score: 100, correct: true, total: 1, // These untrusted fields must be ignored.
    }, owner);
    expect(result.response.status).toBe(200);
    assessment = result.data.assessment;
  }
  return assessment;
}
beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec(await Bun.file(new URL("../../migrations/0002_learning.sql", import.meta.url)).text());
  sqlite.exec(`CREATE TABLE materials (id TEXT PRIMARY KEY,owner_hash TEXT,title TEXT,questions_json TEXT,visibility TEXT)`);
  db = adapter(sqlite);
  cookie = (await getLearningIdentity(new Request(ORIGIN + "/api/learning/progress"))).cookie!.split(";")[0];
});
afterEach(() => sqlite.close());

describe("anonymous session and quota", () => {
  test("stable hashed ownership, HttpOnly sliding one-year cookie, duplicates rotate", async () => {
    const first = await getLearningIdentity(new Request(ORIGIN + "/api/learning/progress", { headers: { Cookie: cookie } }));
    const again = await getLearningIdentity(new Request(ORIGIN + "/api/learning/progress", { headers: { Cookie: cookie } }));
    expect(first.ownerHash).toBe(again.ownerHash);
    expect(first.ownerHash).not.toBe(cookie.split("=")[1]);
    expect(first.cookie).toContain("HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=31536000");
    const duplicate = await getLearningIdentity(new Request(ORIGIN + "/api/learning/progress", { headers: { Cookie: cookie + "; " + cookie } }));
    expect(duplicate.ownerHash).not.toBe(first.ownerHash);
  });
  test("twenty simultaneous quota requests allow exactly five and store no raw IP", async () => {
    const request = new Request(ORIGIN, { headers: { "CF-Connecting-IP": "192.0.2.70" } });
    const results = await Promise.all(Array.from({ length: 20 }, () => allowLearningRate(request, db, "quota-test", 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
    const row = sqlite.query("SELECT * FROM learning_rate_limits").get() as any;
    expect(row.attempts).toBe(5);
    expect(row.ip_hash).not.toContain("192.0.2");
    expect(row.ip_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("owned sequential assessment protocol", () => {
  test("start and GET expose only one public question and no answer key or explanations", async () => {
    const assessment = await start();
    expect(assessment.questionCount).toBe(5);
    expect(assessment.answered).toBe(0);
    expect(Object.keys(assessment.question).sort()).toEqual(["id", "kind", "prompt"]);
    const read = await call("/api/learning/assessments/" + assessment.id);
    expect(read.data.assessment).toEqual(assessment);
    const encoded = JSON.stringify(read.data);
    expect(encoded).not.toContain('"answer":');
    expect(encoded).not.toContain('"explanation":');
    expect(encoded).not.toContain("state_json");
    expect(read.response.headers.get("Cache-Control")).toBe("no-store");
  });
  test("foreign browser cannot read, activate or answer an owned attempt", async () => {
    const assessment = await start();
    const stranger = (await getLearningIdentity(new Request(ORIGIN))).cookie!.split(";")[0];
    for (const [path, method, body] of [
      ["/api/learning/assessments/" + assessment.id, "GET", undefined],
      ["/api/learning/assessments/" + assessment.id + "/next", "POST", {}],
      ["/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: assessment.question.id, answer: "1" }],
    ] as const) {
      const result = await call(path, method, body, stranger);
      expect(result.response.status).toBe(404);
      expect(JSON.stringify(result.data)).not.toContain(assessment.question.prompt);
    }
    expect(saved(assessment.id).state.answers).toHaveLength(0);
  });
  test("skipping to a later private question and forged score fields are rejected", async () => {
    const assessment = await start();
    const later = saved(assessment.id).state.questions[1];
    const skip = await call("/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: later.id, answer: String(later.answer), score: 100 });
    expect(skip.response.status).toBe(409);
    const result = await complete(assessment, false);
    expect(result.summary.correct).toBe(0);
    expect(result.summary.score).toBe(0);
    expect(result.summary.canAdvance).toBe(false);
  });
  test("identical concurrent submission grades once; different stale replay returns conflict", async () => {
    const assessment = await start();
    const q = saved(assessment.id).state.questions.find((q: any) => q.id === assessment.question.id);
    const input = { assessmentId: assessment.id, questionId: q.id, answer: String(q.answer), reasoning: "Пояснение" };
    const results = await Promise.all([call("/api/learning/answers", "POST", input), call("/api/learning/answers", "POST", input)]);
    expect(results.map(r => r.response.status)).toEqual([200, 200]);
    expect(results.every(r => r.data.correct === true)).toBe(true);
    expect(saved(assessment.id).state.answers).toHaveLength(1);
    expect(saved(assessment.id).row.revision).toBe(1);
    const conflict = await call("/api/learning/answers", "POST", { ...input, answer: "wrong" });
    expect(conflict.response.status).toBe(409);
    const duplicate = await call("/api/learning/answers", "POST", input);
    expect(duplicate.data.feedback).toBe(results[0].data.feedback);
    expect(saved(assessment.id).row.revision).toBe(1);
  });
  test("two different simultaneous submissions cannot overwrite the winning answer", async () => {
    const assessment = await start();
    const q = saved(assessment.id).state.questions.find((q: any) => q.id === assessment.question.id);
    const base = { assessmentId: assessment.id, questionId: q.id };
    const results = await Promise.all([
      call("/api/learning/answers", "POST", { ...base, answer: String(q.answer) }),
      call("/api/learning/answers", "POST", { ...base, answer: "wrong" }),
    ]);
    expect(results.map(r => r.response.status).sort()).toEqual([200, 409]);
    expect(saved(assessment.id).state.answers).toHaveLength(1);
    expect(saved(assessment.id).row.revision).toBe(1);
  });
  test("plain reasoning is stored but explicitly awaits review, never semantic AI grading", async () => {
    const result = await complete(await start(), true, cookie, "Я объяснил решение своими словами.");
    expect(result.summary.automatic).toBe(true);
    expect(result.summary.reasoningProvided).toBe(true);
    expect(result.summary.reviewStatus).toBe("needs-review");
    expect(saved(result.id).state.answers[0].reasoning).toContain("своими словами");
  });
});

describe("optional timed issuance", () => {
  test("next prompt is hidden until activation and reading feedback consumes no minute", async () => {
    const assessment = await start("math-arithmetic", "diagnostic", true);
    expect(assessment.deadlineAt).toBeGreaterThan(Date.now());
    const q = saved(assessment.id).state.questions.find((q: any) => q.id === assessment.question.id);
    const answered = await call("/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: q.id, answer: String(q.answer) });
    expect(answered.data.assessment.completed).toBe(false);
    expect(answered.data.assessment.question).toBeNull();
    expect(answered.data.assessment.deadlineAt).toBeNull();
    const read = await call("/api/learning/assessments/" + assessment.id);
    expect(read.data.assessment.question).toBeNull();
    const hidden = saved(assessment.id).state.questions[1];
    expect(JSON.stringify(read.data)).not.toContain(hidden.prompt);
    const premature = await call("/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: hidden.id, answer: String(hidden.answer) });
    expect(premature.response.status).toBe(409);
    const [a, b] = await Promise.all([
      call("/api/learning/assessments/" + assessment.id + "/next", "POST", {}),
      call("/api/learning/assessments/" + assessment.id + "/next", "POST", {}),
    ]);
    expect(a.data.assessment.question.id).toBe(hidden.id);
    expect(b.data.assessment.question.id).toBe(hidden.id);
    expect(a.data.assessment.deadlineAt).toBe(b.data.assessment.deadlineAt);
    expect(a.data.assessment.deadlineAt).toBeGreaterThan(Date.now());
    expect(saved(assessment.id).row.revision).toBe(2);
  });
  test("server deadline rejects even correct late answers; empty expiry accepted, empty timely answer not accepted", async () => {
    const assessment = await start("math-arithmetic", "diagnostic", true);
    const empty = await call("/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: assessment.question.id, answer: "" });
    expect(empty.response.status).toBe(400);
    const { state } = saved(assessment.id);
    state.questionStartedAt = Date.now() - 61_000;
    sqlite.query("UPDATE learning_attempts SET state_json=? WHERE id=?").run(JSON.stringify(state), assessment.id);
    const expired = await call("/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: assessment.question.id, answer: "" });
    expect(expired.response.status).toBe(200);
    expect(expired.data.correct).toBe(false);
    expect(expired.data.feedback).toContain("истекло");
    expect(saved(assessment.id).state.answers).toHaveLength(1);
  });
  test("self-paced attempts have no deadline and never require next activation", async () => {
    const assessment = await start();
    expect(assessment.deadlineAt).toBeNull();
    const q = saved(assessment.id).state.questions.find((q: any) => q.id === assessment.question.id);
    const result = await call("/api/learning/answers", "POST", { assessmentId: assessment.id, questionId: q.id, answer: String(q.answer) });
    expect(result.data.assessment.question).not.toBeNull();
    expect(result.data.assessment.deadlineAt).toBeNull();
  });
});

describe("mastery and review graph", () => {
  test("locked practice stays locked, diagnostic can inspect prior knowledge, two modes unlock next foundation", async () => {
    const locked = await call("/api/learning/assessments", "POST", { topicId: "math-fractions", mode: "practice" });
    expect(locked.response.status).toBe(409);
    const inspect = await start("math-fractions", "diagnostic");
    expect(inspect.topicId).toBe("math-fractions");
    const diagnostic = await complete(await start());
    expect(diagnostic.summary.score).toBe(100);
    expect(diagnostic.summary.canAdvance).toBe(false);
    let progress = (await call("/api/learning/progress")).data.progress;
    expect(progress.find((p: any) => p.topicId === "math-arithmetic").diagnosticPassed).toBe(true);
    expect(progress.find((p: any) => p.topicId === "math-arithmetic").transferPassed).toBe(false);
    const transfer = await complete(await start("math-arithmetic", "transfer"));
    expect(transfer.summary.canAdvance).toBe(true);
    expect(transfer.summary.reasoningRequired).toBe(true);
    progress = (await call("/api/learning/progress")).data.progress;
    expect(progress.find((p: any) => p.topicId === "math-arithmetic").status).toBe("ready");
    expect((await start("math-fractions", "practice")).topicId).toBe("math-fractions");
  });
  test("review schedule follows 1/3/7/14/30 days, overdue preserves provisional mastery", async () => {
    await complete(await start());
    await complete(await start("math-arithmetic", "transfer"));
    const identity = await getLearningIdentity(new Request(ORIGIN, { headers: { Cookie: cookie } }));
    const anchor = Date.now() - 100_000;
    const rows = sqlite.query("SELECT id,mode FROM learning_attempts ORDER BY created_at").all() as any[];
    rows.forEach((row, i) => sqlite.query("UPDATE learning_attempts SET completed_at=? WHERE id=?").run(anchor + i, row.id));
    let progress = await getLearningProgress(db, identity.ownerHash, anchor);
    expect(progress.find(p => p.topicId === "math-arithmetic")!.nextReviewAt).toBe(anchor + 1 + 86_400_000);
    for (const [index, days] of [3, 7, 14, 30, 30].entries()) {
      const reviewed = await complete(await start("math-arithmetic", "practice"));
      const completedAt = anchor + 100 + index;
      sqlite.query("UPDATE learning_attempts SET completed_at=? WHERE id=?").run(completedAt, reviewed.id);
      progress = await getLearningProgress(db, identity.ownerHash, completedAt);
      expect(progress.find(p => p.topicId === "math-arithmetic")!.nextReviewAt).toBe(completedAt + days * 86_400_000);
    }
    const late = await getLearningProgress(db, identity.ownerHash, anchor + 100 * 86_400_000);
    const own = late.find(p => p.topicId === "math-arithmetic")!;
    expect(own.status).toBe("review");
    expect(own.diagnosticPassed && own.transferPassed).toBe(true);
    expect(own.attempts).toBe(7);
  });
  test("imported material is owner/private or explicit unlisted, never unlocks curated subjects", async () => {
    const owner = await getLearningIdentity(new Request(ORIGIN, { headers: { Cookie: cookie } }));
    const materialId = crypto.randomUUID();
    const questions = Array.from({ length: 3 }, (_, i) => ({ id: crypto.randomUUID(), kind: "choice", prompt: "Авторский вопрос " + i, options: ["Да", "Нет"], answer: "Да", explanation: "Авторский разбор", transfer: false }));
    sqlite.query("INSERT INTO materials(id,owner_hash,title,questions_json,visibility) VALUES(?,?,?,?,?)").run(materialId, owner.ownerHash, "Авторский материал", JSON.stringify(questions), "private");
    const stranger = (await getLearningIdentity(new Request(ORIGIN))).cookie!.split(";")[0];
    const forbidden = await call("/api/learning/assessments", "POST", { materialId, mode: "diagnostic" }, stranger);
    expect(forbidden.response.status).toBe(404);
    sqlite.query("UPDATE materials SET visibility='unlisted' WHERE id=?").run(materialId);
    const started = await call("/api/learning/assessments", "POST", { materialId, mode: "transfer" }, stranger);
    expect(started.response.status).toBe(201);
    const result = await complete(started.data.assessment, true, stranger);
    expect(result.summary.score).toBe(100);
    expect(result.summary.canAdvance).toBe(false);
    expect(result.topicId).toBeNull();
    const progress = (await call("/api/learning/progress", "GET", undefined, stranger)).data.progress;
    expect(progress.every((p: any) => p.attempts === 0 && p.status === "new")).toBe(true);
    expect((await call("/api/learning/assessments/" + result.id)).response.status).toBe(404);
  });
});

describe("request boundaries", () => {
  test("exact POST origin, method, body and unsupported roadmap checks", async () => {
    expect((await call("/api/learning/assessments", "POST", { topicId: "math-arithmetic", mode: "diagnostic" }, cookie, { Origin: "https://university.test.evil" })).response.status).toBe(403);
    expect((await call("/api/learning/progress", "GET", undefined, cookie, { "Sec-Fetch-Site": "cross-site" })).response.status).toBe(403);
    expect((await call("/api/learning/progress", "POST", {})).response.status).toBe(405);
    expect((await call("/api/learning/assessments", "POST", { topicId: "math-not-existing", mode: "diagnostic" })).response.status).toBe(409);
    expect((await call("/api/learning/assessments", "POST", { topicId: "math-arithmetic", materialId: crypto.randomUUID(), mode: "diagnostic" })).response.status).toBe(400);
    expect((await call("/api/learning/assessments", "POST", { topicId: "math-arithmetic", mode: "made-up" })).response.status).toBe(400);
    expect((await call("/api/learning/answers", "POST", { answer: "1".repeat(20000) })).response.status).toBe(413);
    const missing = await handleLearning(new Request(ORIGIN + "/api/learning/progress"), {});
    expect(missing?.status).toBe(503);
  });
  test("streaming body is bounded even without Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"answer":"'));
        controller.enqueue(new Uint8Array(17000).fill(65));
        controller.enqueue(new TextEncoder().encode('"}')); controller.close();
      },
    });
    const response = await handleLearning(new Request(ORIGIN + "/api/learning/answers", {
      method: "POST", headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" }, body: stream, duplex: "half",
    } as RequestInit), { DB: db });
    expect(response?.status).toBe(413);
  });
});
