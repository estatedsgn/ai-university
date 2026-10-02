#!/usr/bin/env node
"use strict";

/**
 * Run after bun run build, from app/.
 * AIU_TEST_TOOLS points to a prefix with playwright and wrangler installed.
 * Uses a real local Worker, migrated SQLite D1, and native Chromium fetch/forms.
 * The only browser instrumentation counts media calls and delegates unchanged.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const dns = require("node:dns");
const { execFileSync, spawn } = require("node:child_process");

dns.setDefaultResultOrder("ipv4first");
const toolsDir = process.env.AIU_TEST_TOOLS;
assert.ok(toolsDir, "Set AIU_TEST_TOOLS to the installed test tools prefix.");
const { chromium } = require(path.join(toolsDir, "node_modules", "playwright"));
const wrangler = path.join(toolsDir, "node_modules", ".bin", "wrangler");
const base = "http://localhost:8787";
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "aiu-knowledge-ci-state-"));
const resultsDir = path.resolve("test-results");
fs.mkdirSync(resultsDir, { recursive: true });
const checks = [];
const pageErrors = [];
let worker;
let browser;
let page;
let workerLog = "";
let failed;
const record = (name) => { checks.push(name); console.log("PASS " + name); };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = { Origin: base };
const quiz = {
  title: "Локальный тест понимания",
  summary: "Пять независимых вопросов для проверки импорта и серверной оценки.",
  questions: [
    { prompt: "Сколько будет два плюс три?", options: ["Пять", "Четыре", "Шесть", "Семь"], correctIndex: 0, explanation: "Две единицы и ещё три составляют пять." },
    { prompt: "Какая фигура имеет три стороны?", options: ["Круг", "Квадрат", "Треугольник", "Пятиугольник"], correctIndex: 2, explanation: "Треугольник имеет ровно три стороны." },
    { prompt: "Как называется половина целого?", options: ["Одна треть", "Одна вторая", "Одна четвёртая", "Две трети"], correctIndex: 1, explanation: "Одна из двух равных частей — одна вторая." },
    { prompt: "Сколько сантиметров в одном метре?", options: ["Десять", "Тысяча", "Пятьдесят", "Сто"], correctIndex: 3, explanation: "Метр состоит из ста сантиметров." },
    { prompt: "Какое число меньше всех остальных?", options: ["Девять", "Семь", "Два", "Пять"], correctIndex: 2, explanation: "Два меньше пяти, семи и девяти." },
  ],
};
const expectedOptions = new Map(quiz.questions.map((item) => [item.prompt, item.options[item.correctIndex]]));

function publicQuestion(question) {
  assert.ok(question && typeof question.id === "string", "A current question is required.");
  assert.ok(["number", "choice"].includes(question.kind));
  for (const key of Object.keys(question)) {
    assert.ok(["id", "prompt", "kind", "options"].includes(key), "Unexpected public question field: " + key);
  }
  assert.equal(Object.hasOwn(question, "answer"), false);
  assert.equal(Object.hasOwn(question, "explanation"), false);
  assert.equal(Object.hasOwn(question, "correctIndex"), false);
}
function arithmeticAnswer(prompt) {
  // Independent, explicit arithmetic parsing; no answer keys or eval.
  const patterns = [
    [/^Вычисли (\d+) \+ (\d+)\.$/, (a, b) => a + b],
    [/^Вычисли (\d+) ÷ (\d+)\.$/, (a, b) => a / b],
    [/^Вычисли (\d+) \+ (\d+) × (\d+)\.$/, (a, b, c) => a + b * c],
    [/^Вычисли \((\d+) \+ (\d+)\) × (\d+)\.$/, (a, b, c) => (a + b) * c],
    [/^Вычисли (\d+) − (\d+)\.$/, (a, b) => a - b],
    [/^Купили (\d+) тетрадей, затем ещё (\d+)\. Сколько всего\?$/, (a, b) => a + b],
    [/^(\d+) книг разложили поровну на (\d+) полок\. Сколько на полке\?$/, (a, b) => a / b],
    [/^Есть (\d+) отдельных деталей и (\d+) коробок по (\d+) деталей\. Сколько деталей\?$/, (a, b, c) => a + b * c],
    [/^В каждой из (\d+) партий (\d+) красных и (\d+) синих шаров\. Сколько шаров всего\?$/, (c, a, b) => c * (a + b)],
    [/^На складе (\d+) упаковок, отправили (\d+)\. Сколько осталось\?$/, (a, b) => a - b],
  ];
  for (const [pattern, solve] of patterns) {
    const match = prompt.match(pattern);
    if (match) return String(solve(...match.slice(1).map(Number)));
  }
  throw new Error("Unknown arithmetic prompt; update independent test parser: " + prompt);
}
async function nativeApi(targetPage, route, body) {
  return targetPage.evaluate(async ({ route, body }) => {
    const response = await fetch(route, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  }, { route, body });
}
async function successfulApi(route, body) {
  const response = await nativeApi(page, route, body);
  assert.ok(response.status >= 200 && response.status < 300, route + " returned " + response.status + ": " + JSON.stringify(response.json));
  return response.json;
}
async function noOverflow(label) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dimensions.html <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1,
    label + " overflow: " + JSON.stringify(dimensions));
  assert.equal(await page.evaluate(() => window.__aiuMediaRequests), 0, "Knowledge pages must not request camera or microphone.");
}
async function selectTopic(title) {
  const topic = page.locator(".kh-topic").filter({ has: page.getByText(title, { exact: true }) });
  await topic.click();
  await page.waitForFunction((expected) => document.querySelector("#kh-topic-title")?.textContent === expected, title);
}
async function waitProgress() {
  await page.waitForFunction(() => {
    const text = document.querySelector(".kh-progress-line")?.textContent || "";
    return text.includes("тем с подтверждённой основой");
  });
}
async function takeUiAttempt(answerForPrompt, onFirstAnswer) {
  const startResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/learning/assessments" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Начать проверку", exact: true }).click();
  const started = await startResponse;
  assert.equal(started.status(), 201);
  let current = (await started.json()).assessment;
  assert.equal(current.questionCount, 5);
  for (let index = 0; index < 5; index += 1) {
    publicQuestion(current.question);
    const prompt = current.question.prompt;
    await page.waitForFunction((expected) =>
      document.querySelector(".kp-question-heading")?.textContent === expected, prompt);
    const answer = answerForPrompt(prompt);
    if (current.question.kind === "choice") {
      await page.locator(".kp-options").getByRole("radio", { name: answer, exact: true }).check();
    } else {
      await page.getByLabel("Ваш ответ", { exact: true }).fill(answer);
    }
    const reasoning = "Решаю независимо по условию задачи и проверяю единицы.";
    await page.getByLabel(/^Как вы рассуждали/).fill(reasoning);
    const answerResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/learning/answers" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    const gradedResponse = await answerResponse;
    assert.equal(gradedResponse.status(), 200);
    const result = await gradedResponse.json();
    assert.equal(result.correct, true, result.feedback);
    assert.equal(result.assessment.answered, index + 1);
    await page.locator(".kp-feedback").waitFor({ state: "visible" });
    assert.equal(await page.locator(".kp-question-heading").textContent(), prompt, "Feedback keeps the answered question visible.");
    if (index === 0 && onFirstAnswer) {
      await onFirstAnswer(current, answer, reasoning, result);
    }
    if (index < 4) {
      publicQuestion(result.assessment.question);
      const nextResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/next") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Следующий вопрос", exact: true }).click();
      const next = await nextResponse;
      assert.equal(next.status(), 200);
      current = (await next.json()).assessment;
    } else {
      assert.equal(result.assessment.completed, true);
      assert.equal(result.assessment.summary.score, 100);
      await page.getByRole("button", { name: "Посмотреть итог", exact: true }).click();
      await page.locator(".kp-summary").waitFor({ state: "visible" });
      assert.match(await page.locator(".kp-summary h3").textContent(), /5 из 5.*100%/);
      return result.assessment;
    }
  }
  throw new Error("Attempt did not complete.");
}

async function main() {
  assert.ok(fs.existsSync("wrangler.jsonc"), "Run this test from app/.");
  assert.ok(fs.existsSync("dist/server/server.js"), "Run bun run build before the browser smoke.");
  execFileSync(wrangler, [
    "d1", "migrations", "apply", "ai-university-db", "--local",
    "--config", "wrangler.jsonc", "--persist-to", persist,
  ], { input: "", encoding: "utf8", timeout: 45_000, env: { ...process.env, CI: "true" }, stdio: ["pipe", "pipe", "pipe"] });
  worker = spawn(wrangler, [
    "dev", "--config", "wrangler.jsonc", "--ip", "127.0.0.1", "--port", "8787", "--persist-to", persist,
  ], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CI: "true" } });
  const appendLog = (chunk) => { workerLog = (workerLog + chunk.toString()).slice(-16_000); };
  worker.stdout.on("data", appendLog);
  worker.stderr.on("data", appendLog);
  let spawnError;
  worker.on("error", (error) => { spawnError = error; });
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (worker.exitCode !== null) throw new Error("Wrangler stopped before startup.");
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) { ready = true; break; }
    } catch { /* Startup may briefly refuse connections. */ }
    await pause(250);
  }
  assert.ok(ready, "Local Worker did not serve the built app within 30 seconds.");
  record("real Worker started with fresh migrated SQLite D1");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__aiuMediaRequests = 0;
    const nativeCapture = navigator.mediaDevices?.getUserMedia;
    if (nativeCapture) {
      navigator.mediaDevices.getUserMedia = function (...args) {
        window.__aiuMediaRequests += 1;
        return Reflect.apply(nativeCapture, this, args);
      };
    }
  });
  page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Карта знаний", exact: true }).click();
  await waitProgress();
  await noOverflow("desktop knowledge map");
  record("knowledge map opens without media capture or desktop overflow");

  await page.getByRole("button", { name: "Аккредитация", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать черновик программы (.json)", exact: true }).click();
  const download = await downloadEvent;
  assert.equal(await download.failure(), null);
  const curriculum = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(curriculum.topics.length, 85);
  assert.equal(new Set(curriculum.topics.map((topic) => topic.id)).size, 85);
  assert.equal(curriculum.assessmentPolicy.accreditation, false);
  const knownIds = new Set(curriculum.topics.map((topic) => topic.id));
  for (const topic of curriculum.topics) {
    assert.ok(topic.prerequisites.every((id) => knownIds.has(id)), "Unknown prerequisite in exported curriculum.");
    assert.equal(Object.hasOwn(topic, "answer"), false);
    assert.equal(Object.hasOwn(topic, "progress"), false);
  }
  const arithmetic = curriculum.topics.find((topic) => topic.id === "math-arithmetic");
  const fractions = curriculum.topics.find((topic) => topic.id === "math-fractions");
  assert.ok(arithmetic && fractions);
  record("curriculum download exports 85 linked nodes without private progress or accreditation claim");

  await page.getByRole("button", { name: "Темы", exact: true }).click();
  await selectTopic(fractions.title);
  assert.equal(await page.getByRole("button", { name: "Тренироваться", exact: true }).isDisabled(), true);
  record("fractions practice is gated before arithmetic evidence");

  await page.getByRole("button", { name: "Мои материалы", exact: true }).click();
  await page.getByLabel(/^JSON теста/).fill(JSON.stringify(quiz));
  const importResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/materials/import" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Импортировать тест", exact: true }).click();
  const importedResponse = await importResponse;
  assert.ok(importedResponse.status() >= 200 && importedResponse.status() < 300);
  const material = (await importedResponse.json()).material;
  assert.equal(material.title, quiz.title);
  assert.equal(material.origin, "agent");
  assert.equal(material.visibility, "private");
  assert.equal(Object.hasOwn(material, "questions"), false);
  await page.locator(".ms-result h3").waitFor({ state: "visible" });
  assert.equal(await page.locator(".ms-result h3").textContent(), quiz.title);
  await page.getByRole("button", { name: "Проверить понимание →", exact: true }).click();
  const importedAttempt = await takeUiAttempt((prompt) => {
    assert.ok(expectedOptions.has(prompt), "Unexpected imported question.");
    return expectedOptions.get(prompt);
  });
  assert.equal(importedAttempt.summary.canAdvance, false);
  const afterImport = await successfulApi("/api/learning/progress");
  const importedMath = afterImport.progress.find((entry) => entry.topicId === "math-arithmetic");
  assert.equal(importedMath.attempts, 0);
  assert.equal(importedMath.diagnosticPassed, false);
  assert.equal(importedMath.transferPassed, false);
  record("agent JSON import scores 100% through UI without unlocking curriculum topics");

  await page.getByRole("button", { name: "Вернуться к теме", exact: true }).click();
  await page.getByRole("button", { name: "Темы", exact: true }).click();
  await waitProgress();
  await selectTopic(fractions.title);
  assert.equal(await page.getByRole("button", { name: "Тренироваться", exact: true }).isDisabled(), true);
  await selectTopic(arithmetic.title);
  await page.getByRole("button", { name: "Проверить, что уже знаю", exact: true }).click();
  const foreign = await browser.newContext();
  await takeUiAttempt(arithmeticAnswer, async (attempt, answer, reasoning, result) => {
    const duplicate = await successfulApi("/api/learning/answers", {
      assessmentId: attempt.id, questionId: attempt.question.id, answer, reasoning,
    });
    assert.equal(duplicate.assessment.answered, 1);
    assert.equal(duplicate.correct, result.correct);
    assert.equal(duplicate.feedback, result.feedback);
    const forbidden = await foreign.request.get(base + "/api/learning/assessments/" + encodeURIComponent(attempt.id), { headers });
    assert.ok([403, 404].includes(forbidden.status()));
    record("public question keys are hidden, duplicate answer is idempotent, foreign attempt is inaccessible");
  });
  await foreign.close();
  const diagnostic = (await successfulApi("/api/learning/progress")).progress.find((entry) => entry.topicId === arithmetic.id);
  assert.equal(diagnostic.diagnosticPassed, true);
  assert.equal(diagnostic.transferPassed, false);
  record("numeric diagnostic completes through UI with independently computed answers");

  await page.getByRole("button", { name: "Вернуться к теме", exact: true }).click();
  await waitProgress();
  await selectTopic(fractions.title);
  assert.equal(await page.getByRole("button", { name: "Тренироваться", exact: true }).isDisabled(), true);
  await selectTopic(arithmetic.title);
  await page.getByRole("button", { name: "Применить в новой задаче", exact: true }).click();
  assert.equal(await page.getByRole("radio", { name: /Применить знания/ }).isChecked(), true);
  await takeUiAttempt(arithmeticAnswer);
  const progressed = (await successfulApi("/api/learning/progress")).progress.find((entry) => entry.topicId === arithmetic.id);
  assert.equal(progressed.diagnosticPassed, true);
  assert.equal(progressed.transferPassed, true);
  assert.equal(progressed.status, "ready");
  await page.getByRole("button", { name: "Вернуться к теме", exact: true }).click();
  await waitProgress();
  await selectTopic(fractions.title);
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll(".kh-detail-actions button")].find((item) => item.textContent === "Тренироваться");
    return button && !button.disabled;
  });
  assert.equal(await page.getByRole("button", { name: "Тренироваться", exact: true }).isDisabled(), false);
  record("separate contextual transfer unlocks fractions practice in the UI");

  const timed = (await successfulApi("/api/learning/assessments", {
    topicId: arithmetic.id, mode: "practice", timed: true,
  })).assessment;
  publicQuestion(timed.question);
  const timedAnswer = (await successfulApi("/api/learning/answers", {
    assessmentId: timed.id, questionId: timed.question.id, answer: arithmeticAnswer(timed.question.prompt),
  })).assessment;
  assert.equal(timedAnswer.deadlineAt, null);
  assert.equal(timedAnswer.question, null, "Next timed prompt must remain hidden during explanation.");
  const waiting = (await successfulApi("/api/learning/assessments/" + timed.id)).assessment;
  assert.equal(waiting.deadlineAt, null);
  assert.equal(waiting.question, null);
  const activated = (await successfulApi("/api/learning/assessments/" + timed.id + "/next", {})).assessment;
  publicQuestion(activated.question);
  assert.ok(activated.deadlineAt > Date.now());
  record("server starts the next optional timer only on Next and hides its prompt before activation");

  await noOverflow("desktop final state");
  await page.screenshot({ path: path.join(resultsDir, "knowledge-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow("mobile knowledge map");
  await page.screenshot({ path: path.join(resultsDir, "knowledge-mobile.png"), fullPage: true });
  record("390px mobile layout fits and both review screenshots are saved");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Карта знаний", exact: true }).click();
  await waitProgress();
  await selectTopic(fractions.title);
  assert.equal(await page.getByRole("button", { name: "Тренироваться", exact: true }).isDisabled(), false);
  await noOverflow("mobile restored state");
  assert.deepEqual(pageErrors, []);
  record("cookie-backed progress survives reload without browser errors or hidden media requests");
}

(async () => {
  try { await main(); }
  catch (error) {
    failed = error;
    console.error(error.stack || String(error));
    if (workerLog) console.error("Worker log tail:\n" + workerLog.slice(-8000));
    if (page) {
      try { await page.screenshot({ path: path.join(resultsDir, "knowledge-failure.png"), fullPage: true }); }
      catch { /* Preserve the original failure. */ }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (worker?.pid) {
      try { process.kill(-worker.pid, "SIGTERM"); } catch { /* Already stopped. */ }
      await pause(500);
      try { process.kill(-worker.pid, "SIGKILL"); } catch { /* Already stopped. */ }
    }
    fs.rmSync(persist, { recursive: true, force: true });
    fs.writeFileSync(path.join(resultsDir, "report.json"), JSON.stringify({
      passed: !failed, checks, pageErrors, node: process.version, createdAt: new Date().toISOString(),
      environment: "Built local Cloudflare Worker + fresh SQLite D1 + Chromium",
      screenshots: ["knowledge-desktop.png", "knowledge-mobile.png"],
      failure: failed ? String(failed.stack || failed).slice(0, 8000) : null,
      scope: "Synthetic local material; no external model calls, real students, recordings, or accreditation checks.",
    }, null, 2));
  }
  if (failed) process.exitCode = 1;
})();
