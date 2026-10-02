import type { D1Database } from "@cloudflare/workers-types";
import type {
  AnswerInput, AnswerResult, AssessmentMode, AssessmentStartInput,
  AssessmentSummary, AssessmentView, PrivateQuestion, PublicQuestion, TopicProgress,
} from "./learning-types";
import { TOPICS, getTopic, getAvailability } from "./curriculum";
import { generateQuestions, gradeAnswer, READY_TOPIC_IDS } from "./assessment-bank.server";
import { getLearningIdentity, allowLearningRate } from "./learning-session.server";

type LearningEnv = { DB?: D1Database };
type StoredAnswer = {
  questionId: string; answer: string; reasoning: string; correct: boolean;
  feedback: string; answeredAt: number;
};
type AttemptState = {
  topicTitle: string; questions: PrivateQuestion[]; answers: StoredAnswer[];
  timed: boolean; questionStartedAt: number | null; summary?: AssessmentSummary;
};
type AttemptRow = {
  id: string; owner_hash: string; topic_id: string | null; material_id: string | null;
  mode: AssessmentMode; state_json: string; revision: number;
  created_at: number; updated_at: number; completed_at: number | null;
};
type ProgressAggregate = {
  topic_id: string; attempts: number; best_score: number; diagnostic_passed: number;
  transfer_passed: number; transfer_pass_count: number; last_pass_at: number | null;
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MAX_BODY_BYTES = 16_384;
const QUESTION_MS = 60_000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];
const readyIds = new Set<string>(READY_TOPIC_IDS);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function json(value: unknown, status = 200, cookie: string | null = null): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(value), { status, headers });
}
async function readJSON(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Отправьте данные в формате JSON.");
  }
  const length = request.headers.get("Content-Length");
  if (length && Number(length) > MAX_BODY_BYTES) throw new HttpError(413, "Слишком большой ответ.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Пустой запрос.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "", bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Слишком большой ответ.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Проверьте формат запроса.");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Проверьте формат запроса.");
  } finally { reader.releaseLock(); }
}
function mode(value: unknown): value is AssessmentMode {
  return value === "diagnostic" || value === "practice" || value === "transfer";
}
function publicQuestion(question: PrivateQuestion): PublicQuestion {
  return { id: question.id, prompt: question.prompt, kind: question.kind, ...(question.options ? { options: [...question.options] } : {}) };
}
function parseState(row: AttemptRow): AttemptState {
  const state = JSON.parse(row.state_json) as AttemptState;
  if (!state || !Array.isArray(state.questions) || !Array.isArray(state.answers) || state.questions.length < 1) {
    throw new HttpError(503, "Эта попытка временно недоступна.");
  }
  return state;
}
function view(row: AttemptRow, state: AttemptState, progress?: TopicProgress[]): AssessmentView {
  const completed = state.answers.length >= state.questions.length;
  const current = completed ? null : state.questions[state.answers.length];
  const ownProgress = row.topic_id ? progress?.find(item => item.topicId === row.topic_id) : undefined;
  const summary = state.summary ? {
    ...state.summary,
    canAdvance: row.topic_id !== null && !!ownProgress?.diagnosticPassed && !!ownProgress?.transferPassed,
  } : undefined;
  return {
    id: row.id, topicId: row.topic_id, topicTitle: state.topicTitle, mode: row.mode,
    questionCount: state.questions.length, answered: state.answers.length,
    question: current ? publicQuestion(current) : null,
    deadlineAt: current && state.timed && state.questionStartedAt !== null ? state.questionStartedAt + QUESTION_MS : null,
    completed, ...(completed && summary ? { summary } : {}),
  };
}

/** The database aggregates server-created completed attempts, never a browser-provided score. */
export async function getLearningProgress(db: D1Database, ownerHash: string, now = Date.now()): Promise<TopicProgress[]> {
  const { results } = await db.prepare(
    `SELECT topic_id, COUNT(*) AS attempts,
      MAX(CAST(json_extract(state_json, '$.summary.score') AS INTEGER)) AS best_score,
      MAX(CASE WHEN mode='diagnostic' AND CAST(json_extract(state_json, '$.summary.score') AS INTEGER)>=80 THEN 1 ELSE 0 END) AS diagnostic_passed,
      MAX(CASE WHEN mode='transfer' AND CAST(json_extract(state_json, '$.summary.score') AS INTEGER)>=80 THEN 1 ELSE 0 END) AS transfer_passed,
      SUM(CASE WHEN mode='transfer' AND CAST(json_extract(state_json, '$.summary.score') AS INTEGER)>=80 THEN 1 ELSE 0 END) AS transfer_pass_count,
      MAX(CASE WHEN mode IN ('diagnostic','practice','transfer') AND CAST(json_extract(state_json, '$.summary.score') AS INTEGER)>=80 THEN completed_at ELSE NULL END) AS last_pass_at
     FROM learning_attempts WHERE owner_hash=? AND topic_id IS NOT NULL AND completed_at IS NOT NULL
     GROUP BY topic_id`
  ).bind(ownerHash).all<ProgressAggregate>();
  const aggregates = new Map((results ?? []).map(item => [item.topic_id, item]));
  return TOPICS.map(topic => {
    const item = aggregates.get(topic.id);
    const diagnosticPassed = !!item?.diagnostic_passed;
    const transferPassed = !!item?.transfer_passed;
    const ready = diagnosticPassed && transferPassed;
    const interval = REVIEW_DAYS[Math.min(Math.max((item?.transfer_pass_count ?? 1) - 1, 0), REVIEW_DAYS.length - 1)];
    const nextReviewAt = ready && item?.last_pass_at ? item.last_pass_at + interval * 86_400_000 : null;
    return {
      topicId: topic.id, attempts: item?.attempts ?? 0, bestScore: item?.best_score ?? 0,
      diagnosticPassed, transferPassed,
      status: ready ? (nextReviewAt !== null && nextReviewAt <= now ? "review" : "ready") : item ? "practice" : "new",
      nextReviewAt,
    };
  });
}
async function ownedAttempt(db: D1Database, id: string, ownerHash: string): Promise<AttemptRow> {
  if (!UUID.test(id)) throw new HttpError(404, "Попытка не найдена.");
  const row = await db.prepare("SELECT * FROM learning_attempts WHERE id=? AND owner_hash=?").bind(id, ownerHash).first<AttemptRow>();
  if (!row) throw new HttpError(404, "Попытка не найдена в этом браузере.");
  return row;
}
async function publicView(db: D1Database, row: AttemptRow, state: AttemptState): Promise<AssessmentView> {
  return view(row, state, state.summary ? await getLearningProgress(db, row.owner_hash) : undefined);
}
function validateImportedQuestions(value: unknown): PrivateQuestion[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 15) throw new HttpError(503, "В материале нет доступного теста.");
  return value.map(item => {
    if (!item || typeof item !== "object" || typeof item.prompt !== "string" ||
      typeof item.explanation !== "string" || item.prompt.length > 2000 ||
      item.explanation.length > 3000 || !["choice", "number"].includes(item.kind)) {
      throw new HttpError(503, "Тест материала требует проверки.");
    }
    if (item.kind === "choice" && (!Array.isArray(item.options) || item.options.length < 2 ||
      item.options.length > 6 || !item.options.every((option: unknown) => typeof option === "string" && option.length <= 1000) ||
      typeof item.answer !== "string" || !item.options.includes(item.answer))) {
      throw new HttpError(503, "Тест материала требует проверки.");
    }
    if (item.kind === "number" && !["number", "string"].includes(typeof item.answer)) throw new HttpError(503, "Тест материала требует проверки.");
    return { id: crypto.randomUUID(), prompt: item.prompt, kind: item.kind,
      ...(item.kind === "choice" ? { options: [...item.options] } : {}),
      answer: item.answer, explanation: item.explanation, transfer: false } as PrivateQuestion;
  });
}
function shuffled<T>(input: T[]): T[] {
  const values = [...input];
  for (let i = values.length - 1; i > 0; i--) {
    const span = i + 1, ceiling = Math.floor(0x100000000 / span) * span;
    const random = new Uint32Array(1);
    do { crypto.getRandomValues(random); } while (random[0] >= ceiling);
    const j = random[0] % span;
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
async function start(db: D1Database, ownerHash: string, input: Record<string, unknown>): Promise<AssessmentView> {
  if (!mode(input.mode) || (input.timed !== undefined && typeof input.timed !== "boolean")) {
    throw new HttpError(400, "Выберите режим проверки.");
  }
  const hasTopic = typeof input.topicId === "string" && input.topicId.length > 0;
  const hasMaterial = typeof input.materialId === "string" && input.materialId.length > 0;
  if (hasTopic === hasMaterial) throw new HttpError(400, "Выберите одну тему или один материал.");
  let questions: PrivateQuestion[], topicTitle: string;
  let topicId: string | null = null, materialId: string | null = null;
  if (hasTopic) {
    const topic = getTopic(input.topicId as string);
    if (!topic || topic.assessment !== "ready" || !readyIds.has(topic.id)) throw new HttpError(409, "Для этой темы тест ещё готовится.");
    if (input.mode !== "diagnostic") {
      const availability = getAvailability(topic, await getLearningProgress(db, ownerHash));
      if (!availability.unlocked) throw new HttpError(409, "Сначала проверь базовые темы. Диагностика доступна для проверки прежних знаний.");
    }
    questions = generateQuestions(topic.id, input.mode);
    topicTitle = topic.title; topicId = topic.id;
  } else {
    if (!UUID.test(input.materialId as string)) throw new HttpError(404, "Материал не найден.");
    const material = await db.prepare(
      "SELECT id, title, questions_json FROM learning_materials WHERE id=? AND (owner_hash=? OR visibility='unlisted')"
    ).bind(input.materialId, ownerHash).first<{ id: string; title: string; questions_json: string }>();
    if (!material) throw new HttpError(404, "Материал не найден или доступен только автору.");
    questions = shuffled(validateImportedQuestions(JSON.parse(material.questions_json)));
    topicTitle = material.title; materialId = material.id;
  }
  const now = Date.now();
  const state: AttemptState = { topicTitle, questions, answers: [], timed: input.timed === true,
    questionStartedAt: input.timed === true ? now : null };
  const row: AttemptRow = {
    id: crypto.randomUUID(), owner_hash: ownerHash, topic_id: topicId, material_id: materialId,
    mode: input.mode, state_json: JSON.stringify(state), revision: 0,
    created_at: now, updated_at: now, completed_at: null,
  };
  await db.prepare(
    "INSERT INTO learning_attempts(id,owner_hash,topic_id,material_id,mode,state_json,revision,created_at,updated_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,NULL)"
  ).bind(row.id, row.owner_hash, row.topic_id, row.material_id, row.mode, row.state_json, row.revision, now, now).run();
  return view(row, state);
}
function replay(state: AttemptState, input: AnswerInput): StoredAnswer | undefined {
  const stored = state.answers.find(item => item.questionId === input.questionId);
  if (!stored) return undefined;
  if (stored.answer !== input.answer.trim() || stored.reasoning !== (input.reasoning ?? "").trim()) {
    throw new HttpError(409, "На этот вопрос уже сохранён другой ответ. Открой текущую попытку.");
  }
  return stored;
}
function answerInput(value: Record<string, unknown>): AnswerInput {
  if (typeof value.assessmentId !== "string" || typeof value.questionId !== "string" ||
    typeof value.answer !== "string" || value.answer.length > 1000 ||
    (value.reasoning !== undefined && (typeof value.reasoning !== "string" || value.reasoning.length > 3000))) {
    throw new HttpError(400, "Проверь ответ и пояснение.");
  }
  return { assessmentId: value.assessmentId, questionId: value.questionId,
    answer: value.answer.trim(), reasoning: typeof value.reasoning === "string" ? value.reasoning.trim() : "" };
}
async function answer(db: D1Database, ownerHash: string, input: AnswerInput): Promise<AnswerResult> {
  let row = await ownedAttempt(db, input.assessmentId, ownerHash);
  let state = parseState(row);
  const previous = replay(state, input);
  if (previous) return { correct: previous.correct, feedback: previous.feedback, assessment: await publicView(db, row, state) };
  const current = state.questions[state.answers.length];
  if (!current || current.id !== input.questionId) throw new HttpError(409, "Вопрос уже изменился. Открой текущую попытку.");
  if (state.timed && state.questionStartedAt === null) throw new HttpError(409, "Нажми «Следующий вопрос», чтобы начать таймер.");
  const now = Date.now();
  const expired = state.timed && state.questionStartedAt !== null && now > state.questionStartedAt + QUESTION_MS;
  if (!input.answer && !expired) throw new HttpError(400, "Сначала введи ответ.");
  const correct = !expired && gradeAnswer(current, input.answer);
  const feedback = (expired ? "Время на этот вопрос истекло. " : correct ? "Верно. " : "Пока неверно. ") + current.explanation;
  state.answers.push({ questionId: current.id, answer: input.answer, reasoning: input.reasoning ?? "",
    correct, feedback, answeredAt: now });
  // Reading the explanation must not consume the next timed question's minute.
  state.questionStartedAt = null;
  const completed = state.answers.length >= state.questions.length;
  if (completed) {
    const correctCount = state.answers.filter(item => item.correct).length;
    const reasoningProvided = state.answers.some(item => item.reasoning.length > 0);
    state.summary = {
      correct: correctCount, total: state.questions.length,
      score: Math.round(correctCount * 100 / state.questions.length), automatic: true,
      reasoningRequired: row.mode === "transfer", reasoningProvided,
      reviewStatus: reasoningProvided ? "needs-review" : row.mode === "transfer" ? "practice-evidence" : "self-check",
      completedAt: now, canAdvance: false,
    };
  }
  const result = await db.prepare(
    "UPDATE learning_attempts SET state_json=?, revision=revision+1, updated_at=?, completed_at=? WHERE id=? AND owner_hash=? AND revision=?"
  ).bind(JSON.stringify(state), now, completed ? now : null, row.id, ownerHash, row.revision).run();
  if (result.meta.changes !== 1) {
    row = await ownedAttempt(db, input.assessmentId, ownerHash); state = parseState(row);
    const duplicate = replay(state, input);
    if (duplicate) return { correct: duplicate.correct, feedback: duplicate.feedback, assessment: await publicView(db, row, state) };
    throw new HttpError(409, "Ответ изменился в другой вкладке. Открой текущую попытку.");
  }
  row = { ...row, state_json: JSON.stringify(state), revision: row.revision + 1,
    updated_at: now, completed_at: completed ? now : null };
  return { correct, feedback, assessment: await publicView(db, row, state) };
}
async function activateNext(db: D1Database, ownerHash: string, id: string): Promise<AssessmentView> {
  let row = await ownedAttempt(db, id, ownerHash), state = parseState(row);
  if (!state.timed || state.summary || state.questionStartedAt !== null) return publicView(db, row, state);
  const now = Date.now(); state.questionStartedAt = now;
  const result = await db.prepare(
    "UPDATE learning_attempts SET state_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_hash=? AND revision=?"
  ).bind(JSON.stringify(state), now, id, ownerHash, row.revision).run();
  if (result.meta.changes === 1) row = { ...row, state_json: JSON.stringify(state), revision: row.revision + 1, updated_at: now };
  else { row = await ownedAttempt(db, id, ownerHash); state = parseState(row); }
  return publicView(db, row, state);
}

/** Sequential owned assessments, with server-only grading and no claim of cheat-proof testing. */
export async function handleLearning(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/learning/")) return null;
  const route = url.pathname;
  const assessmentMatch = route.match(/^\/api\/learning\/assessments\/([^/]+)$/);
  const nextMatch = route.match(/^\/api\/learning\/assessments\/([^/]+)\/next$/);
  const supported = route === "/api/learning/progress" || route === "/api/learning/assessments" ||
    route === "/api/learning/answers" || assessmentMatch || nextMatch;
  if (!supported) return json({ error: "Раздел обучения не найден." }, 404);
  const expectedMethod = route === "/api/learning/progress" || assessmentMatch ? "GET" : "POST";
  if (request.method !== expectedMethod) return json({ error: "Метод запроса не поддерживается." }, 405);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" ||
    (request.method === "POST" && request.headers.get("Origin") !== url.origin)) {
    return json({ error: "Открой проверку на сайте AI Университета." }, 403);
  }
  const db = (env as LearningEnv | null)?.DB;
  if (!db) return json({ error: "Хранилище обучения временно недоступно." }, 503);
  let cookie: string | null = null;
  try {
    const identity = await getLearningIdentity(request); cookie = identity.cookie;
    const ownerHash = identity.ownerHash;
    const bucket = request.method === "GET" ? "learning-read" : route === "/api/learning/assessments" ? "assessment-start" : "assessment-write";
    const max = bucket === "assessment-start" ? 200 : 3000;
    if (!await allowLearningRate(request, db, bucket, max)) {
      throw new HttpError(429, "Технический лимит запросов на сегодня достигнут. Это не ограничение числа учебных попыток; вернись завтра.");
    }
    if (route === "/api/learning/progress") return json({ progress: await getLearningProgress(db, ownerHash), today: Date.now() }, 200, cookie);
    if (assessmentMatch) {
      const row = await ownedAttempt(db, assessmentMatch[1], ownerHash);
      return json({ assessment: await publicView(db, row, parseState(row)) }, 200, cookie);
    }
    const body = await readJSON(request);
    if (nextMatch) return json({ assessment: await activateNext(db, ownerHash, nextMatch[1]) }, 200, cookie);
    if (route === "/api/learning/assessments") return json({ assessment: await start(db, ownerHash, body) }, 201, cookie);
    return json(await answer(db, ownerHash, answerInput(body)), 200, cookie);
  } catch (error) {
    return json({ error: error instanceof HttpError ? error.message : "Не удалось сохранить обучение. Попробуй ещё раз." },
      error instanceof HttpError ? error.status : 503, cookie);
  }
}
