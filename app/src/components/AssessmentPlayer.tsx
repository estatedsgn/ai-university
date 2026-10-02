import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  AnswerInput,
  AnswerResult,
  AssessmentMode,
  AssessmentStartInput,
  AssessmentView,
  PublicQuestion,
} from "../lib/learning-types";
import "../assessment-player.css";

type AssessmentPlayerProps = {
  topicId?: string;
  materialId?: string;
  title: string;
  initialMode?: AssessmentMode;
  onComplete: () => void;
  onClose: () => void;
};
type AnswerPayload = AnswerInput & { requestId: string };
type PendingAnswer = { payload: AnswerPayload; question: PublicQuestion };
type Feedback = {
  question: PublicQuestion;
  answer: string;
  reasoning: string;
  correct: boolean | null;
  text: string;
};
class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
const MODES: { id: AssessmentMode; title: string; description: string }[] = [
  { id: "diagnostic", title: "Проверить базу", description: "Посмотреть, что уже понятно и где нужна практика." },
  { id: "practice", title: "Потренироваться", description: "Решить задания и разобрать каждый ответ." },
  { id: "transfer", title: "Применить знания", description: "Попробовать новую ситуацию и объяснить ход решения." },
];
function isView(value: unknown): value is AssessmentView {
  if (!value || typeof value !== "object") return false;
  const view = value as Partial<AssessmentView>;
  return typeof view.id === "string" && typeof view.completed === "boolean" &&
    typeof view.answered === "number" && typeof view.questionCount === "number" &&
    (view.question === null || Boolean(view.question && typeof view.question.id === "string"));
}
function readView(value: unknown): AssessmentView {
  const view = value && typeof value === "object" ? (value as { assessment?: unknown }).assessment : null;
  if (!isView(view)) throw new RequestError("Не удалось прочитать ответ сервера. Проверьте соединение.", 0);
  return view;
}
function readAnswer(value: unknown): AnswerResult {
  const assessment = readView(value);
  const result = value as Partial<AnswerResult>;
  if (typeof result.correct !== "boolean" || typeof result.feedback !== "string") {
    throw new RequestError("Сервер не вернул разбор ответа. Проверим, сохранился ли он.", 0);
  }
  return { assessment, correct: result.correct, feedback: result.feedback };
}
function timeLabel(seconds: number): string {
  return String(Math.floor(seconds / 60)) + ":" + String(seconds % 60).padStart(2, "0");
}

export function AssessmentPlayer({
  topicId, materialId, title, initialMode = "diagnostic", onComplete, onClose,
}: AssessmentPlayerProps) {
  const id = useId();
  const [mode, setMode] = useState<AssessmentMode>(initialMode);
  const [timed, setTimed] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAnswer | null>(null);
  const [now, setNow] = useState(0);
  const mounted = useRef(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const pendingRef = useRef<PendingAnswer | null>(null);
  const requests = useRef(new Set<AbortController>());
  const autoExpired = useRef<string | null>(null);
  const notified = useRef<string | null>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const feedbackPanel = useRef<HTMLDivElement>(null);
  const summaryPanel = useRef<HTMLDivElement>(null);
  const completionHandler = useRef(onComplete);
  completionHandler.current = onComplete;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      for (const controller of requests.current) controller.abort();
      requests.current.clear();
    };
  }, []);
  useEffect(() => {
    generation.current += 1;
    for (const controller of requests.current) controller.abort();
    requests.current.clear();
    locked.current = false;
    pendingRef.current = null;
    autoExpired.current = null;
    notified.current = null;
    setMode(initialMode);
    setAssessment(null);
    setFeedback(null);
    setAnswer("");
    setReasoning("");
    setError("");
    setPending(null);
    setBusy(false);
  }, [topicId, materialId, initialMode]);

  const question = feedback?.question ?? assessment?.question ?? null;
  const showingSummary = Boolean(assessment?.completed && !feedback);
  useEffect(() => {
    if (feedback) feedbackPanel.current?.focus();
    else if (showingSummary) summaryPanel.current?.focus();
    else if (question) questionHeading.current?.focus();
  }, [question, feedback, showingSummary]);
  useEffect(() => {
    if (!showingSummary || !assessment || notified.current === assessment.id) return;
    notified.current = assessment.id;
    completionHandler.current();
  }, [showingSummary, assessment]);
  useEffect(() => {
    if (!assessment?.deadlineAt || assessment.completed || feedback) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [assessment?.id, assessment?.question?.id, assessment?.deadlineAt, assessment?.completed, feedback]);

  async function request(path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    requests.current.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "include",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      let data: unknown;
      try { data = await response.json(); }
      catch { throw new RequestError("Сервер временно недоступен. Проверьте соединение.", response.status); }
      if (!response.ok) {
        const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
        const message = typeof record.error === "string" ? record.error :
          typeof record.message === "string" ? record.message : "Не удалось выполнить запрос. Попробуйте ещё раз.";
        throw new RequestError(message, response.status);
      }
      return data;
    } finally {
      window.clearTimeout(timeout);
      requests.current.delete(controller);
    }
  }
  function validTurn(turn: number): boolean {
    return mounted.current && generation.current === turn;
  }
  function rememberPending(value: PendingAnswer | null) {
    pendingRef.current = value;
    setPending(value);
  }
  function applyAnswer(result: AnswerResult, submitted: PendingAnswer) {
    setAssessment(result.assessment);
    setFeedback({
      question: submitted.question,
      answer: submitted.payload.answer,
      reasoning: submitted.payload.reasoning ?? "",
      correct: result.correct,
      text: result.feedback,
    });
    rememberPending(null);
    setError("");
  }

  async function startAttempt() {
    if (locked.current) return;
    if ((!topicId && !materialId) || (topicId && materialId)) {
      setError("Выберите одну тему или один материал для проверки.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    const turn = generation.current;
    const input: AssessmentStartInput = { mode, timed, ...(topicId ? { topicId } : { materialId }) };
    try {
      const view = readView(await request("/api/learning/assessments", input));
      if (!validTurn(turn)) return;
      setAssessment(view);
      setFeedback(null);
      setAnswer("");
      setReasoning("");
      rememberPending(null);
      autoExpired.current = null;
      notified.current = null;
      setNow(Date.now());
    } catch (cause) {
      if (validTurn(turn)) setError(cause instanceof RequestError ? cause.message : "Не удалось начать проверку. Попробуйте ещё раз.");
    } finally {
      if (validTurn(turn)) { locked.current = false; setBusy(false); }
    }
  }

  async function recoverAnswer(submitted: PendingAnswer, turn: number) {
    try {
      const view = readView(await request("/api/learning/assessments/" + encodeURIComponent(submitted.payload.assessmentId)));
      if (!validTurn(turn)) return;
      if (view.completed || view.question?.id !== submitted.payload.questionId) {
        // Identical replay recovers feedback. The server stores one answer per question.
        try {
          const replay = readAnswer(await request("/api/learning/answers", submitted.payload));
          if (validTurn(turn)) applyAnswer(replay, submitted);
        } catch {
          if (!validTurn(turn)) return;
          setAssessment(view);
          setFeedback({
            question: submitted.question,
            answer: submitted.payload.answer,
            reasoning: submitted.payload.reasoning ?? "",
            correct: null,
            text: "Сервер сохранил ответ, но разбор не удалось восстановить. Итог попытки будет показан по данным сервера.",
          });
          rememberPending(null);
          setError("");
        }
      } else {
        setAssessment(view);
        setError("Сохранение ответа пока не подтверждено. Повторная отправка использует тот же ответ и не добавляет баллы дважды.");
      }
    } catch {
      if (validTurn(turn)) setError("Соединение прервалось. Сначала проверим сохранение этого ответа; менять его пока нельзя.");
    }
  }

  async function sendAnswer(submitted: PendingAnswer) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    rememberPending(submitted);
    const turn = generation.current;
    try {
      const result = readAnswer(await request("/api/learning/answers", submitted.payload));
      if (validTurn(turn)) applyAnswer(result, submitted);
    } catch (cause) {
      if (!validTurn(turn)) return;
      if (cause instanceof RequestError && cause.status >= 400 && cause.status < 500 && cause.status !== 409) {
        // A validation/rate rejection is explicit; no uncertain answer is shown as graded.
        rememberPending(null);
        setError(cause.message);
      } else {
        await recoverAnswer(submitted, turn);
      }
    } finally {
      if (validTurn(turn)) { locked.current = false; setBusy(false); }
    }
  }

  function submitAnswer(expired = false) {
    if (!assessment?.question || feedback || pendingRef.current || locked.current) return;
    if (!expired && !answer.trim()) {
      setError("Введите ответ или выберите вариант.");
      return;
    }
    const submitted: PendingAnswer = {
      question: assessment.question,
      payload: {
        assessmentId: assessment.id,
        questionId: assessment.question.id,
        answer: expired ? "" : assessment.question.kind === "choice" ? answer : answer.trim(),
        reasoning: reasoning.trim(),
        requestId: crypto.randomUUID(),
      },
    };
    void sendAnswer(submitted);
  }
  const remaining = assessment?.deadlineAt && now
    ? Math.max(0, Math.ceil((assessment.deadlineAt - now) / 1000)) : null;
  useEffect(() => {
    if (remaining !== 0 || !assessment?.question || feedback || pending || busy ||
      autoExpired.current === assessment.question.id) return;
    autoExpired.current = assessment.question.id;
    submitAnswer(true);
    // Timer only requests expiry; the server decides whether the answer is late.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, assessment?.question?.id, feedback, pending, busy]);

  async function nextQuestion() {
    if (!assessment || locked.current) return;
    if (assessment.completed) {
      setFeedback(null);
      setAnswer("");
      setReasoning("");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    const turn = generation.current;
    try {
      const view = readView(await request("/api/learning/assessments/" + encodeURIComponent(assessment.id) + "/next", {}));
      if (!validTurn(turn)) return;
      setAssessment(view);
      setFeedback(null);
      setAnswer("");
      setReasoning("");
      autoExpired.current = null;
      setNow(Date.now());
    } catch (cause) {
      if (validTurn(turn)) setError(cause instanceof RequestError ? cause.message : "Не удалось открыть следующий вопрос. Повторите действие.");
    } finally {
      if (validTurn(turn)) { locked.current = false; setBusy(false); }
    }
  }

  function chooseAnotherMode() {
    if (locked.current) return;
    setAssessment(null);
    setFeedback(null);
    setAnswer("");
    setReasoning("");
    setError("");
    rememberPending(null);
    autoExpired.current = null;
  }
  const summary = assessment?.summary;
  const disabled = busy || Boolean(feedback) || Boolean(pending);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitAnswer();
  }

  return (
    <section className="kp-player" aria-labelledby={id + "-title"} aria-busy={busy}>
      <header className="kp-header">
        <div>
          <span className="kp-eyebrow">Проверка понимания</span>
          <h2 id={id + "-title"}>{title}</h2>
        </div>
        <button type="button" className="kp-button kp-button-quiet" onClick={onClose}>Закрыть</button>
      </header>

      {!assessment && (
        <div className="kp-setup">
          <p className="kp-lead">Один вопрос за раз. После ответа — разбор, затем следующий шаг.</p>
          <fieldset className="kp-mode-list" disabled={busy}>
            <legend>Что хочется проверить?</legend>
            {MODES.map((item) => (
              <label className={"kp-mode" + (mode === item.id ? " kp-selected" : "")} key={item.id}>
                <input type="radio" name={id + "-mode"} value={item.id} checked={mode === item.id}
                  onChange={() => setMode(item.id)} />
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
              </label>
            ))}
          </fieldset>
          <label className="kp-timer-choice">
            <input type="checkbox" checked={timed} disabled={busy} onChange={(event) => setTimed(event.target.checked)} />
            <span>60 секунд на вопрос</span>
          </label>
          <p className="kp-muted">По умолчанию можно думать без ограничения. Таймер тренирует темп, но не подтверждает самостоятельность ответа.</p>
          <button type="button" className="kp-button" disabled={busy} onClick={() => void startAttempt()}>
            {busy ? "Подготовка вопросов…" : "Начать проверку"}
          </button>
        </div>
      )}

      {assessment && !showingSummary && question && (
        <div className="kp-assessment">
          <div className="kp-progress-line">
            <span>Вопрос {feedback ? assessment.answered : assessment.answered + 1} из {assessment.questionCount}</span>
            <span>{MODES.find((item) => item.id === assessment.mode)?.title}</span>
            {!feedback && remaining !== null && (
              <output className={"kp-timer" + (remaining <= 10 ? " kp-timer-short" : "")} role="timer" aria-live="off"
                aria-label={"Осталось " + remaining + " секунд"}>{timeLabel(remaining)}</output>
            )}
          </div>
          <progress className="kp-progress" max={Math.max(1, assessment.questionCount)}
            value={assessment.answered} aria-label="Отвечено вопросов" />
          <form onSubmit={handleSubmit} className="kp-question-form">
            <h3 ref={questionHeading} tabIndex={-1} className="kp-question-heading">{question.prompt}</h3>
            {question.kind === "choice" ? (
              <fieldset className="kp-options" disabled={disabled}>
                <legend className="kp-sr-only">Выберите один ответ</legend>
                {question.options?.map((option, index) => (
                  <label key={index} className={"kp-option" + (answer === option ? " kp-selected" : "")}>
                    <input type="radio" name={id + "-answer-" + question.id} checked={answer === option}
                      onChange={() => { setAnswer(option); setError(""); }} />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="kp-field">
                <label htmlFor={id + "-number"}>Ваш ответ</label>
                <input id={id + "-number"} type="text" inputMode="text" maxLength={128} autoComplete="off"
                  spellCheck={false} disabled={disabled} value={answer}
                  aria-describedby={id + "-number-help"}
                  onChange={(event) => { setAnswer(event.target.value); setError(""); }} placeholder="Например: 0,5 или 1/2" />
                <p id={id + "-number-help"} className="kp-muted">Можно вводить число с точкой или запятой, а также дробь: 1/2.</p>
              </div>
            )}
            <div className="kp-field">
              <label htmlFor={id + "-reasoning"}>Как вы рассуждали? <span className="kp-muted">(необязательно)</span></label>
              <textarea id={id + "-reasoning"} rows={3} maxLength={3000} disabled={disabled} value={reasoning}
                aria-describedby={id + "-reasoning-help"}
                onChange={(event) => setReasoning(event.target.value)}
                placeholder="Коротко опишите ход решения своими словами." />
              <p id={id + "-reasoning-help"} className="kp-muted">Объяснение сохраняется для проверки преподавателем. Автоматически оценивается только выбранный вариант или число.</p>
            </div>
            {!feedback && !pending && (
              <button type="submit" className="kp-button" disabled={busy}>
                {busy ? "Проверка ответа…" : "Ответить"}
              </button>
            )}
          </form>

          {pending && !feedback && (
            <div className="kp-recovery" role="status">
              <p>{busy ? "Проверяем сохранение ответа…" : "Ответ ожидает подтверждения сервера."}</p>
              <button type="button" className="kp-button" disabled={busy}
                onClick={() => void sendAnswer(pending)}>Повторить отправку этого ответа</button>
            </div>
          )}

          {feedback && (
            <div ref={feedbackPanel} tabIndex={-1}
              className={"kp-feedback" + (feedback.correct === false ? " kp-feedback-practice" : "")} role="status">
              <strong>{feedback.correct === null ? "Ответ сохранён" : feedback.correct ? "Верно" : "Разберём решение"}</strong>
              <p>{feedback.text}</p>
              <button type="button" className="kp-button" disabled={busy} onClick={() => void nextQuestion()}>
                {busy ? "Открываем…" : assessment.completed ? "Посмотреть итог" : "Следующий вопрос"}
              </button>
            </div>
          )}
        </div>
      )}

      {showingSummary && (
        <div ref={summaryPanel} tabIndex={-1} className="kp-summary">
          <span className="kp-eyebrow">Попытка завершена</span>
          <h3>{summary ? summary.correct + " из " + summary.total + " · " + Math.round(summary.score) + "%" : "Результат сохранён"}</h3>
          <p className="kp-lead">{summary?.canAdvance
            ? "По этим заданиям можно попробовать следующий шаг."
            : "Теперь видно, что стоит разобрать и потренировать ещё."}</p>
          <p className="kp-muted">Это предварительная проверка по конкретным заданиям. Она не подтверждает полное владение темой или самостоятельность решения.</p>
          {summary?.reasoningRequired && !summary.reasoningProvided && (
            <p className="kp-review-note">Для переноса знаний важно объяснить ход решения. В следующей попытке добавьте объяснение.</p>
          )}
          {summary?.reasoningProvided && (
            <p className="kp-review-note">Ход решения сохранён и требует проверки преподавателем. Свободный текст не оценивался автоматически.</p>
          )}
          <div className="kp-actions">
            <button type="button" className="kp-button" disabled={busy} onClick={() => void startAttempt()}>
              {busy ? "Готовим новую попытку…" : "Ещё попытка"}
            </button>
            <button type="button" className="kp-button kp-button-quiet" disabled={busy} onClick={chooseAnotherMode}>
              Выбрать другой режим
            </button>
            <button type="button" className="kp-button kp-button-quiet" onClick={onClose}>Вернуться к теме</button>
          </div>
          <p className="kp-muted">Количество попыток не ограничено. В новой попытке сервер подбирает варианты заданий.</p>
        </div>
      )}

      {error && <p className="kp-error" role="alert">{error}</p>}
      {assessment && !assessment.completed && !assessment.question && !feedback && (
        <div className="kp-recovery">
          <p>Разбор завершён. Откройте следующий вопрос, когда будете готовы: таймер начнётся после нажатия.</p>
          <button type="button" className="kp-button" disabled={busy} onClick={() => void nextQuestion()}>
            {busy ? "Открываем…" : "Следующий вопрос"}
          </button>
        </div>
      )}
    </section>
  );
}
