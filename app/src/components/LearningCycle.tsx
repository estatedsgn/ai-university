/* eslint-disable react-refresh/only-export-components -- Export pure learning rules alongside the component for independent validation. */
import { useEffect, useId, useRef, useState } from "react";
import "../learning-cycle.css";

export const CYCLE_STORAGE_KEY = "ai-university:learning-cycle:v1";
export const REVIEW_DAYS = [1, 3, 7, 14, 30] as const;
const DAY_MS = 86_400_000;
const STAGES = [
  "Передача знаний",
  "Вопросы и практика",
  "Усвоение",
  "Повторение",
  "Тестирование",
  "Утренний обзор",
  "Проверка за месяц",
];
const PLAN_LABELS = ["Информация", "Практика", "Усвоение", "Повторение", "Тест"];
const PLAN_PERCENTAGES = [17, 33, 17, 17, 16];

export const LISTENING_QUIZ = [
  {
    question:
      "Собеседник ещё объясняет свою мысль, а у вас уже готов совет. Что поможет лучше понять его?",
    options: [
      "Сразу дать совет, чтобы сэкономить время",
      "Дослушать, коротко пересказать и уточнить, верно ли вы поняли",
      "Молча согласиться со всем",
    ],
    correct: 1,
    explanation:
      "Пересказ проверяет понимание, а уточнение даёт собеседнику возможность исправить вашу версию. Совет уместен после понимания и согласия на него.",
  },
  {
    question: "В группе одновременно начали говорить два человека. Как лучше продолжить?",
    options: [
      "Предложить очередь и дать первому закончить",
      "Говорить громче, чтобы вас услышали",
      "Выключить всем микрофоны до конца занятия",
    ],
    correct: 0,
    explanation:
      "Понятная очередь даёт каждому время высказаться. Микрофон можно выключить на время чужого ответа, но участнику нужно вернуть возможность говорить.",
  },
  {
    question:
      "Коллега говорит: «Я не успеваю с задачами». Какой ответ сочетает отражение и уточнение?",
    options: [
      "Ты просто неправильно планируешь",
      "У всех много задач",
      "Похоже, нагрузка стала тяжёлой. Что сейчас отнимает больше всего времени?",
    ],
    correct: 2,
    explanation:
      "Ответ признаёт переживание и задаёт открытый вопрос. Он не приписывает человеку причину и не обесценивает его опыт.",
  },
  {
    question:
      "Вы кратко пересказали мысль, но собеседник сказал: «Нет, я имел в виду другое». Что делать?",
    options: [
      "Защитить свою версию, ведь вы внимательно слушали",
      "Попросить уточнить и снова проверить понимание",
      "Сменить тему, чтобы избежать неловкости",
    ],
    correct: 1,
    explanation:
      "Проверка понимания нужна именно для обнаружения расхождений. Уточнение помогает скорректировать пересказ без спора.",
  },
  {
    question: "Как проверить, что навык слушания переносится из урока в жизнь?",
    options: [
      "В реальном разговоре дослушать, пересказать смысл и спросить обратную связь",
      "Перечитать определение несколько раз",
      "Запомнить правильные буквы в тесте",
    ],
    correct: 0,
    explanation:
      "Тест проверяет выбор ответа, а реальный разговор — применение навыка. Обратная связь собеседника помогает увидеть, поняли ли вы его.",
  },
] as const;

export function allocateSessionMinutes(minutes: number): number[] {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const exact = PLAN_PERCENTAGES.map((percentage) => (safeMinutes * percentage) / 100);
  const result = exact.map(Math.floor);
  const remainder = safeMinutes - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i += 1) result[order[i].index] += 1;
  return result;
}

export function quizCorrectCount(answers: number[]): number {
  return LISTENING_QUIZ.reduce(
    (score, question, index) => score + Number(answers[index] === question.correct),
    0,
  );
}

export function reviewDueAt(completedAt: string, day: number): string | null {
  const timestamp = Date.parse(completedAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(day) || day < 0) return null;
  const due = new Date(timestamp + day * DAY_MS);
  return Number.isFinite(due.getTime()) ? due.toISOString() : null;
}

type QuizAttempt = {
  id: string;
  kind: "lesson" | "monthly";
  at: string;
  answers: number[];
  correct: number;
};
type CycleState = {
  version: 1;
  goal: string;
  minutes: 15 | 30 | 60;
  gameShare: number;
  completed: number[];
  notes: { practice: string; assimilation: string; recall: string };
  completedAt: string | null;
  reviewedDays: number[];
  attempts: QuizAttempt[];
};
const initialState: CycleState = {
  version: 1,
  goal: "",
  minutes: 30,
  gameShare: 30,
  completed: [],
  notes: { practice: "", assimilation: "", recall: "" },
  completedAt: null,
  reviewedDays: [],
  attempts: [],
};

function safeString(value: unknown, maximum = 2000): string {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function restoreCycleState(raw: string): CycleState | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) return null;
    const attempts: QuizAttempt[] = Array.isArray(parsed.attempts)
      ? parsed.attempts.flatMap((attempt: unknown): QuizAttempt[] => {
          if (!attempt || typeof attempt !== "object") return [];
          const record = attempt as Record<string, unknown>;
          if (
            (record.kind !== "lesson" && record.kind !== "monthly") ||
            !validDate(record.at) ||
            !Array.isArray(record.answers)
          )
            return [];
          if (
            record.answers.length !== LISTENING_QUIZ.length ||
            !record.answers.every(
              (answer: unknown, index: number) =>
                typeof answer === "number" &&
                Number.isInteger(answer) &&
                answer >= 0 &&
                answer < LISTENING_QUIZ[index].options.length,
            )
          )
            return [];
          const answers = record.answers as number[];
          return [
            {
              id: safeString(record.id, 100) || record.at,
              kind: record.kind,
              at: record.at,
              answers,
              correct: quizCorrectCount(answers),
            },
          ];
        })
      : [];
    const notes = parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {};
    return {
      version: 1,
      goal: safeString(parsed.goal, 300),
      minutes: [15, 30, 60].includes(parsed.minutes) ? parsed.minutes : 30,
      gameShare:
        typeof parsed.gameShare === "number" && Number.isFinite(parsed.gameShare)
          ? Math.max(0, Math.min(100, Math.round(parsed.gameShare)))
          : 30,
      completed: Array.isArray(parsed.completed)
        ? [
            ...new Set<number>(
              parsed.completed.filter(
                (step: unknown) =>
                  typeof step === "number" && Number.isInteger(step) && step >= 0 && step <= 6,
              ),
            ),
          ]
        : [],
      notes: {
        practice: safeString(notes.practice),
        assimilation: safeString(notes.assimilation),
        recall: safeString(notes.recall),
      },
      completedAt: validDate(parsed.completedAt) ? parsed.completedAt : null,
      reviewedDays: Array.isArray(parsed.reviewedDays)
        ? [
            ...new Set<number>(
              parsed.reviewedDays.filter(
                (day: unknown) =>
                  typeof day === "number" && (REVIEW_DAYS as readonly number[]).includes(day),
              ),
            ),
          ]
        : [],
      attempts,
    };
  } catch {
    return null;
  }
}

function displayDate(value: string | null): string {
  if (!value) return "После первого теста";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function QuizPanel({
  kind,
  attempts,
  onSubmit,
}: {
  kind: QuizAttempt["kind"];
  attempts: QuizAttempt[];
  onSubmit: (kind: QuizAttempt["kind"], answers: number[]) => QuizAttempt;
}) {
  const id = useId();
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [error, setError] = useState("");
  const ownAttempts = attempts.filter((attempt) => attempt.kind === kind);
  const lastLesson = [...attempts].reverse().find((attempt) => attempt.kind === "lesson");
  const allAnswered = LISTENING_QUIZ.every((_, index) => Number.isInteger(answers[index]));
  const submit = () => {
    if (!allAnswered) {
      setError("Выберите ответ на каждый вопрос.");
      return;
    }
    setError("");
    setResult(onSubmit(kind, answers));
  };
  return (
    <div className="cycle-quiz">
      <p className="cycle-muted">
        5 вопросов · попыток: {ownAttempts.length} · можно повторять сколько угодно
      </p>
      {LISTENING_QUIZ.map((question, index) => (
        <fieldset className="cycle-question" key={question.question}>
          <legend>
            {index + 1}. {question.question}
          </legend>
          {question.options.map((option, optionIndex) => (
            <label
              key={option}
              className={
                result && optionIndex === question.correct
                  ? "cycle-option cycle-option-correct"
                  : "cycle-option"
              }
            >
              <input
                type="radio"
                name={id + "-" + index}
                checked={answers[index] === optionIndex}
                disabled={Boolean(result)}
                onChange={() => {
                  setAnswers((previous) => {
                    const next = [...previous];
                    next[index] = optionIndex;
                    return next;
                  });
                  setError("");
                }}
              />
              <span>{option}</span>
            </label>
          ))}
          {result && (
            <p className="cycle-feedback">
              <strong>
                {result.answers[index] === question.correct ? "Верно. " : "Есть что уточнить. "}
              </strong>
              {question.explanation}
            </p>
          )}
        </fieldset>
      ))}
      {error && (
        <p className="cycle-error" role="alert">
          {error}
        </p>
      )}
      {result ? (
        <div className="cycle-result" role="status">
          <strong>
            Ваш результат: {result.correct} из {LISTENING_QUIZ.length}
          </strong>
          {kind === "monthly" && lastLesson && (
            <p>
              Последний учебный тест: {lastLesson.correct} из 5. Изменение:{" "}
              {result.correct - lastLesson.correct > 0 ? "+" : ""}
              {result.correct - lastLesson.correct} ответа. Это сравнение ответов, а не оценка всего
              навыка.
            </p>
          )}
          <p>
            Разберите объяснения и возвращайтесь, когда захотите. Проходного балла и лимита попыток
            нет.
          </p>
          <button
            type="button"
            className="cycle-button"
            onClick={() => {
              setResult(null);
              setAnswers([]);
              setError("");
            }}
          >
            Попробовать ещё раз
          </button>
        </div>
      ) : (
        <button type="button" className="cycle-button" onClick={submit}>
          Проверить ответы
        </button>
      )}
      {ownAttempts.length > 0 && (
        <div className="cycle-attempt-history">
          <h4>Ваши последние попытки</h4>
          <p className="cycle-muted">
            Показаны последние {Math.min(ownAttempts.length, 5)} из {ownAttempts.length}. Все
            попытки сохранены в этом браузере.
          </p>
          {ownAttempts
            .slice(-5)
            .reverse()
            .map((attempt) => (
              <button
                type="button"
                className="cycle-attempt"
                key={attempt.id}
                onClick={() => {
                  setAnswers([...attempt.answers]);
                  setResult(attempt);
                  setError("");
                }}
              >
                <span>{displayDate(attempt.at)}</span>
                <strong>{attempt.correct} / 5</strong>
                <span>Открыть разбор →</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function LearningCycle({ onPractice }: { onPractice: () => void }) {
  const [state, setState] = useState<CycleState>(initialState);
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);
  const [storage, setStorage] = useState<"saved" | "unavailable">("saved");
  const [mode, setMode] = useState<"regular" | "game">("regular");
  const [showRecall, setShowRecall] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerData = useRef<{ startedAt: number | null; accumulatedMs: number }>({
    startedAt: null,
    accumulatedMs: 0,
  });
  const id = useId();
  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      const data = timerData.current;
      if (data.startedAt !== null) setElapsedMs(data.accumulatedMs + Date.now() - data.startedAt);
    }, 250);
    return () => window.clearInterval(timer);
  }, [timerRunning]);
  const toggleTimer = () => {
    const data = timerData.current;
    if (timerRunning && data.startedAt !== null) {
      data.accumulatedMs += Date.now() - data.startedAt;
      data.startedAt = null;
      setElapsedMs(data.accumulatedMs);
      setTimerRunning(false);
    } else {
      data.startedAt = Date.now();
      setTimerRunning(true);
    }
  };
  const resetTimer = () => {
    timerData.current = { startedAt: null, accumulatedMs: 0 };
    setElapsedMs(0);
    setTimerRunning(false);
  };
  const timerSeconds = Math.floor(elapsedMs / 1000);
  const timerLabel =
    String(Math.floor(timerSeconds / 60)).padStart(2, "0") +
    ":" +
    String(timerSeconds % 60).padStart(2, "0");
  useEffect(() => {
    setNow(Date.now());
    try {
      const raw = window.localStorage.getItem(CYCLE_STORAGE_KEY);
      if (raw) {
        const restored = restoreCycleState(raw);
        if (restored) setState(restored);
      }
    } catch {
      setStorage("unavailable");
    }
    setReady(true);
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(CYCLE_STORAGE_KEY, JSON.stringify(state));
      setStorage("saved");
    } catch {
      setStorage("unavailable");
    }
  }, [state, ready]);

  const minutes = allocateSessionMinutes(state.minutes);
  const gameMinutes = Math.round((minutes[1] * state.gameShare) / 100);
  const lessonAttempts = state.attempts.filter((attempt) => attempt.kind === "lesson");
  const monthlyAttempts = state.attempts.filter((attempt) => attempt.kind === "monthly");
  const lastMonthlyAt = monthlyAttempts.length
    ? monthlyAttempts[monthlyAttempts.length - 1].at
    : state.completedAt;
  const monthlyDue = lastMonthlyAt ? reviewDueAt(lastMonthlyAt, 30) : null;
  const dueReviews = REVIEW_DAYS.filter((day) => {
    const due = state.completedAt ? reviewDueAt(state.completedAt, day) : null;
    return due && now !== null && Date.parse(due) <= now && !state.reviewedDays.includes(day);
  });
  const completeStage = (index: number) => {
    setState((previous) => ({
      ...previous,
      completed: [...new Set([...previous.completed, index])],
    }));
    setStage(Math.min(index + 1, 6));
  };
  const updateNote = (key: keyof CycleState["notes"], value: string) => {
    setState((previous) => ({ ...previous, notes: { ...previous.notes, [key]: value } }));
  };
  const submitQuiz = (kind: QuizAttempt["kind"], answers: number[]): QuizAttempt => {
    const timestamp = new Date().toISOString();
    const attempt: QuizAttempt = {
      id: timestamp + "-" + Math.random().toString(36).slice(2, 8),
      kind,
      at: timestamp,
      answers: [...answers],
      correct: quizCorrectCount(answers),
    };
    setState((previous) => ({
      ...previous,
      attempts: [...previous.attempts, attempt],
      completed: [...new Set([...previous.completed, kind === "lesson" ? 4 : 6])],
      completedAt: kind === "lesson" ? (previous.completedAt ?? timestamp) : previous.completedAt,
    }));
    setNow(Date.now());
    return attempt;
  };
  return (
    <section className="cycle-root" aria-labelledby={id + "-heading"}>
      <div className="cycle-heading">
        <div>
          <span className="cycle-eyebrow">Личный учебный цикл</span>
          <h2 id={id + "-heading"}>Учиться в своём темпе</h2>
          <p>Встроенный модуль «Активное слушание». От первой идеи до привычки в разговоре.</p>
        </div>
        <span className="cycle-badge">7 этапов</span>
      </div>
      <div className="cycle-layout">
        <aside className="cycle-plan" aria-label="Настройки занятия">
          <h3>Ваше занятие</h3>
          <label className="cycle-label" htmlFor={id + "-goal"}>
            Что хотите делать и зачем?
          </label>
          <textarea
            id={id + "-goal"}
            className="cycle-input"
            rows={3}
            maxLength={300}
            value={state.goal}
            placeholder="Например: лучше понимать команду и спокойно обсуждать сложные задачи"
            onChange={(event) =>
              setState((previous) => ({ ...previous, goal: event.target.value }))
            }
          />
          <label className="cycle-label" htmlFor={id + "-minutes"}>
            Сколько времени есть?
          </label>
          <select
            id={id + "-minutes"}
            className="cycle-input"
            value={state.minutes}
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                minutes: Number(event.target.value) as 15 | 30 | 60,
              }))
            }
          >
            <option value={15}>15 минут</option>
            <option value={30}>30 минут</option>
            <option value={60}>60 минут</option>
          </select>
          <label className="cycle-label" htmlFor={id + "-game"}>
            Игровая доля практики <strong>{state.gameShare}%</strong>
          </label>
          <input
            id={id + "-game"}
            className="cycle-range"
            type="range"
            min="0"
            max="100"
            step="5"
            value={state.gameShare}
            onChange={(event) =>
              setState((previous) => ({ ...previous, gameShare: Number(event.target.value) }))
            }
          />
          <p className="cycle-muted">
            Игра: {gameMinutes} мин · обычная практика: {minutes[1] - gameMinutes} мин. Режим можно
            менять или пропускать.
          </p>
          <div className="cycle-time-list" aria-label="Распределение времени">
            {PLAN_LABELS.map((label, index) => (
              <div key={label}>
                <span>
                  {label} <small>{PLAN_PERCENTAGES[index]}%</small>
                </span>
                <strong>{minutes[index]} мин</strong>
              </div>
            ))}
          </div>
          <p className="cycle-muted">
            Это план, а не таймер: длительность можно менять. Утренний обзор — около 3 минут
            отдельно.
          </p>
          <div className="cycle-stopwatch" aria-label="Секундомер самостоятельного занятия">
            <span>Время по вашему таймеру</span>
            <output className="cycle-stopwatch-time">{timerLabel}</output>
            <div className="cycle-actions">
              <button
                type="button"
                className="cycle-button cycle-button-small"
                onClick={toggleTimer}
              >
                {timerRunning ? "Пауза" : elapsedMs ? "Продолжить" : "Старт"}
              </button>
              <button
                type="button"
                className="cycle-button cycle-button-secondary cycle-button-small"
                onClick={resetTimer}
              >
                Сброс
              </button>
            </div>
            <p className="cycle-muted">
              Считает время после нажатия «Старт», включая паузы в разговоре. При выходе из модуля
              сбрасывается; внимание не оценивает.
            </p>
          </div>
          <div className="cycle-local-note" role="status">
            {ready && storage === "unavailable"
              ? "Хранилище браузера недоступно: результаты сохраняются только до закрытия страницы."
              : "Цель, заметки и результаты сохраняются только в этом браузере. Синхронизации с аккаунтом нет."}
          </div>
          <p className="cycle-muted">Не записывайте сюда пароли и конфиденциальные сведения.</p>
        </aside>
        <div className="cycle-main">
          <nav className="cycle-stages" aria-label="Этапы обучения">
            {STAGES.map((label, index) => (
              <button
                type="button"
                key={label}
                aria-current={stage === index ? "step" : undefined}
                className={"cycle-stage" + (stage === index ? " cycle-stage-active" : "")}
                onClick={() => setStage(index)}
              >
                <span className="cycle-stage-number">
                  {state.completed.includes(index) ? "✓" : index + 1}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <article className="cycle-content">
            <div className="cycle-content-heading">
              <span className="cycle-eyebrow">Этап {stage + 1} / 7</span>
              <h3>{STAGES[stage]}</h3>
            </div>
            {stage === 0 && (
              <div>
                <p className="cycle-lead">
                  Активное слушание — это проверка того, поняли ли вы человека, прежде чем отвечать.
                </p>
                <ol className="cycle-principles">
                  <li>
                    <strong>Дайте закончить.</strong> Пауза помогает услышать всю мысль. В группе
                    заранее договоритесь об очереди.
                  </li>
                  <li>
                    <strong>Отразите смысл.</strong> «Если я правильно понял, тебе важно…» — коротко
                    и без своей оценки.
                  </li>
                  <li>
                    <strong>Уточните.</strong> «Что здесь самое сложное?» или «Я верно понял?» —
                    затем снова выслушайте.
                  </li>
                </ol>
                <div className="cycle-example">
                  <span className="cycle-eyebrow">Пример</span>
                  <p>«Мне сложно включаться в обсуждения: меня перебивают».</p>
                  <p>
                    <strong>Ответ:</strong> «Ты хочешь успевать закончить мысль. Как нам лучше
                    распределить очередь?»
                  </p>
                </div>
                <button type="button" className="cycle-button" onClick={() => completeStage(0)}>
                  Понятно, перейти к практике →
                </button>
              </div>
            )}
            {stage === 1 && (
              <div>
                <p>
                  Тренируем один ответ: отражение смысла и открытый вопрос. Оцените себя по трём
                  признакам: нет совета до уточнения, есть пересказ, есть вопрос.
                </p>
                <div className="cycle-modes" aria-label="Режим практики">
                  <button
                    type="button"
                    aria-pressed={mode === "regular"}
                    className={"cycle-mode" + (mode === "regular" ? " cycle-mode-active" : "")}
                    onClick={() => setMode("regular")}
                  >
                    Обычная практика
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "game"}
                    className={"cycle-mode" + (mode === "game" ? " cycle-mode-active" : "")}
                    onClick={() => setMode("game")}
                  >
                    Игровой вызов
                  </button>
                </div>
                <div className="cycle-example">
                  <strong>
                    {mode === "game" ? "Вызов «Сначала понять»" : "Разговор с коллегой"}
                  </strong>
                  <p>
                    «На встречах все говорят одновременно. Я теряю нить и перестаю участвовать».
                  </p>
                  <p>
                    {mode === "game"
                      ? "За 2–3 предложения соберите три элемента: отражение, открытый вопрос, предложение очереди. Без очков и гонки."
                      : "Сначала отразите переживание, затем спросите, что поможет включаться в обсуждение."}
                  </p>
                </div>
                <label className="cycle-label" htmlFor={id + "-practice"}>
                  Как бы вы ответили?
                </label>
                <textarea
                  id={id + "-practice"}
                  className="cycle-input"
                  rows={4}
                  maxLength={2000}
                  value={state.notes.practice}
                  onChange={(event) => updateNote("practice", event.target.value)}
                  placeholder="Похоже, тебе трудно..."
                />
                <p className="cycle-muted">
                  Заметка для самооценки. Автоматической проверки свободного ответа пока нет.
                </p>
                <div className="cycle-actions">
                  <button
                    type="button"
                    className="cycle-button"
                    disabled={state.notes.practice.trim().length < 10}
                    onClick={() => completeStage(1)}
                  >
                    Сохранил ответ, дальше →
                  </button>
                  <button
                    type="button"
                    className="cycle-button cycle-button-secondary"
                    onClick={onPractice}
                  >
                    Практиковать в комнате
                  </button>
                </div>
              </div>
            )}
            {stage === 2 && (
              <div>
                <p className="cycle-lead">
                  Объясните принцип своими словами: так легче заметить пробелы в понимании.
                </p>
                <label className="cycle-label" htmlFor={id + "-assimilation"}>
                  Чем «слушать» отличается от «ждать своей очереди»? Где примените это сегодня?
                </label>
                <textarea
                  id={id + "-assimilation"}
                  className="cycle-input"
                  rows={5}
                  maxLength={2000}
                  value={state.notes.assimilation}
                  onChange={(event) => updateNote("assimilation", event.target.value)}
                  placeholder="Когда я действительно слушаю, я..."
                />
                <p className="cycle-muted">
                  Ориентир: понять смысл и проверить его, а не только подготовить собственный ответ.
                </p>
                <button
                  type="button"
                  className="cycle-button"
                  disabled={state.notes.assimilation.trim().length < 10}
                  onClick={() => completeStage(2)}
                >
                  Зафиксировать понимание →
                </button>
              </div>
            )}
            {stage === 3 && (
              <div>
                <p className="cycle-lead">
                  Сначала вспомните без подсказки, затем сверяйтесь с опорой.
                </p>
                <label className="cycle-label" htmlFor={id + "-recall"}>
                  Какие три действия помогают слушать активно?
                </label>
                <textarea
                  id={id + "-recall"}
                  className="cycle-input"
                  rows={3}
                  maxLength={2000}
                  value={state.notes.recall}
                  onChange={(event) => updateNote("recall", event.target.value)}
                  placeholder="1. ... 2. ... 3. ..."
                />
                <div className="cycle-actions">
                  <button
                    type="button"
                    className="cycle-button cycle-button-secondary"
                    onClick={() => setShowRecall((value) => !value)}
                  >
                    {showRecall ? "Скрыть опору" : "Показать опору"}
                  </button>
                </div>
                {showRecall && (
                  <div className="cycle-example">
                    Дослушать → пересказать смысл без оценки → задать уточняющий вопрос. Если вас
                    поправили, обновить понимание.
                  </div>
                )}
                <button
                  type="button"
                  className="cycle-button"
                  disabled={state.notes.recall.trim().length < 5}
                  onClick={() => completeStage(3)}
                >
                  Повторил, перейти к тесту →
                </button>
              </div>
            )}
            {stage === 4 && (
              <div>
                <p>
                  Проверьте решения в типичных разговорах. Разбор каждого ответа появится после
                  отправки всего теста.
                </p>
                <QuizPanel
                  key="lesson"
                  kind="lesson"
                  attempts={state.attempts}
                  onSubmit={submitQuiz}
                />
              </div>
            )}
            {stage === 5 && (
              <div>
                <p className="cycle-lead">
                  Короткое возвращение к навыку через 1, 3, 7, 14 и 30 дней.
                </p>
                <p>
                  Вспомните три действия, перескажите одну мысль собеседника и выберите разговор,
                  где примените навык сегодня.
                </p>
                {!state.completedAt && (
                  <div className="cycle-example">
                    Пройдите первый учебный тест: его фактическая дата станет началом календаря
                    повторений.
                  </div>
                )}
                {state.completedAt && (
                  <p className="cycle-muted">
                    Начало цикла: {displayDate(state.completedAt)}. Пропущенный обзор можно пройти
                    позже.
                  </p>
                )}
                <div className="cycle-review-list">
                  {REVIEW_DAYS.map((day) => {
                    const dueAt = state.completedAt ? reviewDueAt(state.completedAt, day) : null;
                    const reviewed = state.reviewedDays.includes(day);
                    const due = dueReviews.includes(day);
                    return (
                      <div className="cycle-review-row" key={day}>
                        <span>
                          <strong>День {day}</strong>
                          <small>{displayDate(dueAt)}</small>
                        </span>
                        <span className={"cycle-review-status" + (due ? " cycle-review-due" : "")}>
                          {reviewed ? "Повторено ✓" : due ? "Можно повторить" : "Запланировано"}
                        </span>
                        {due && (
                          <button
                            type="button"
                            className="cycle-button cycle-button-small"
                            onClick={() =>
                              setState((previous) => ({
                                ...previous,
                                reviewedDays: [...new Set([...previous.reviewedDays, day])],
                                completed: [...new Set([...previous.completed, 5])],
                              }))
                            }
                          >
                            Обзор выполнен
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="cycle-muted">
                  Напоминания видны здесь при открытии страницы. Автоматических писем и уведомлений
                  пока нет.
                </p>
                <button
                  type="button"
                  className="cycle-button cycle-button-secondary"
                  onClick={() => setStage(3)}
                >
                  Повторить сейчас
                </button>
              </div>
            )}
            {stage === 6 && (
              <div>
                <p className="cycle-lead">
                  Проверка раз в месяц — ориентир для вас, без спешки и ограничений.
                </p>
                <div className="cycle-example">
                  <strong>
                    {monthlyDue && now !== null && Date.parse(monthlyDue) <= now
                      ? "Время месячной проверки"
                      : "Следующая месячная проверка"}
                  </strong>
                  <p>
                    {displayDate(monthlyDue)}. Вы можете пройти её и раньше, а повторять — сколько
                    захотите.
                  </p>
                </div>
                <p>
                  Тест использует те же ситуации: сравниваются ваши реальные ответы. Для проверки
                  поведения попробуйте навык в разговоре и обсудите опыт с преподавателем.
                </p>
                <p className="cycle-muted">
                  В следующей версии преподаватель сможет предлагать темп. Сейчас вы выбираете время
                  сами.
                </p>
                <QuizPanel
                  key="monthly"
                  kind="monthly"
                  attempts={state.attempts}
                  onSubmit={submitQuiz}
                />
              </div>
            )}
          </article>
          <div className="cycle-summary">
            <span>
              Этапов отмечено: <strong>{state.completed.length} / 7</strong>
            </span>
            <span>
              Учебных тестов: <strong>{lessonAttempts.length}</strong>
            </span>
            <span>
              Последний результат:{" "}
              <strong>
                {lessonAttempts.length
                  ? lessonAttempts[lessonAttempts.length - 1].correct + " / 5"
                  : "пока нет"}
              </strong>
            </span>
          </div>
          <p className="cycle-disclaimer">
            Учебные материалы и тесты в этом MVP подготовлены заранее. Живого ИИ преподавателя здесь
            пока нет.
          </p>
        </div>
      </div>
    </section>
  );
}
