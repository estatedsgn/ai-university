import { useEffect, useState, type FormEvent } from "react";
import { getTopic } from "../lib/curriculum";
import { recommendTrack, validProfile, type LearnerProfile, type LearningRecommendation } from "../lib/onboarding";
import "./student-onboarding.css";

const STORAGE = "aiu-onboarding-v1";
const INITIAL: LearnerProfile = { goal: "", interest: "unsure", experience: "new", minutes: 30, format: "mixed" };
const QUESTIONS = [
  "Чему ты хочешь научиться и зачем?",
  "Какое направление тебе интереснее?",
  "Сколько ты уже знаешь по этой теме?",
  "Сколько времени удобно выделять на занятие?",
  "Как тебе комфортнее учиться?",
];

export function StudentOnboarding({ onOpenKnowledge }: { onOpenKnowledge: (topicId: string) => void }) {
  const [profile, setProfile] = useState<LearnerProfile>(INITIAL);
  const [step, setStep] = useState(0);
  const [suggestion, setSuggestion] = useState<LearningRecommendation | null>(null);
  const [aiNote, setAiNote] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "ai" | "fallback">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
      if (validProfile(saved)) {
        setProfile(saved);
        setSuggestion(recommendTrack(saved));
        setStep(QUESTIONS.length);
      }
    } catch { /* Storage is optional. */ }
  }, []);

  function update<K extends keyof LearnerProfile>(key: K, value: LearnerProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
  }
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && !validProfile({ ...profile, goal: profile.goal.trim().replace(/\s+/g, " ") })) {
      if (profile.goal.trim().length < 5 || profile.goal.trim().length > 500) {
        setError("Опиши цель хотя бы пятью символами, не более 500.");
        return;
      }
    }
    setError("");
    if (step === QUESTIONS.length - 1) {
      const clean = { ...profile, goal: profile.goal.trim().replace(/\s+/g, " ") };
      if (!validProfile(clean)) {
        setError("Проверь ответы перед продолжением.");
        return;
      }
      setProfile(clean);
      setSuggestion(recommendTrack(clean));
      setAiNote("");
      setAiStatus("idle");
      try { localStorage.setItem(STORAGE, JSON.stringify(clean)); } catch { /* Still works in memory. */ }
    }
    setStep((value) => Math.min(value + 1, QUESTIONS.length));
  }
  function reset() {
    try { localStorage.removeItem(STORAGE); } catch {}
    setProfile(INITIAL); setStep(0); setSuggestion(null); setAiNote(""); setAiStatus("idle"); setError("");
  }
  async function askAI() {
    setAiStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/onboarding/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object") throw new Error("Сейчас ИИ-анализ недоступен.");
      const body = data as { recommendation?: LearningRecommendation; note?: string; mode?: "ai" | "fallback" };
      if (!body.recommendation || !["math", "finance", "biology"].includes(body.recommendation.subject) ||
          !getTopic(body.recommendation.topicId)) throw new Error("Не удалось прочитать рекомендацию.");
      setSuggestion(body.recommendation);
      setAiNote(typeof body.note === "string" ? body.note.slice(0, 500) : "");
      setAiStatus(body.mode === "ai" ? "ai" : "fallback");
    } catch {
      setAiStatus("fallback");
      setError("ИИ сейчас недоступен. Предварительный маршрут по ответам остаётся доступным.");
    }
  }
  const choices = step === 1 ? [
    ["unsure", "Ещё выбираю"],
    ["math", "Математика"],
    ["finance", "Финансы"],
    ["biology", "Биология"],
  ] : step === 2 ? [
    ["new", "Начинаю с нуля"],
    ["some", "Кое-что знаю"],
    ["confident", "Уже уверенно разбираюсь"],
  ] : step === 3 ? [
    ["15", "15 минут"],
    ["30", "30 минут"],
    ["60", "60 минут"],
  ] : [
    ["explain", "Сначала объяснение"],
    ["practice", "Больше задач и практики"],
    ["mixed", "Чередовать"],
  ];

  return <section className="ob" aria-label="Персональный учебный маршрут">
    <div className="ob-header"><span className="eyebrow">ПЕРВОЕ ЗНАКОМСТВО</span>
      <h2>Начнём с твоей цели</h2>
      <p>Пять коротких вопросов вместо длинной анкеты. Ответы помогут выбрать направление и первую проверку знаний.</p>
    </div>
    {step < QUESTIONS.length ? <div className="ob-conversation">
      <div className="ob-progress" role="progressbar" aria-label="Ход интервью" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={QUESTIONS.length}><span style={{ width: `${(step + 1) * 100 / QUESTIONS.length}%` }} /></div>
      <div className="ob-message"><span aria-hidden="true">✳</span><div><small>УЧЕБНЫЙ ПОМОЩНИК · ВОПРОС {step + 1} ИЗ {QUESTIONS.length}</small><h3>{QUESTIONS[step]}</h3></div></div>
      <form onSubmit={next}>
        {step === 0 ? <label className="ob-goal"><span className="sr-only">Твоя учебная цель</span>
          <textarea value={profile.goal} onChange={(event) => update("goal", event.target.value)} maxLength={500} required minLength={5} rows={4} placeholder="Например: хочу научиться считать проценты, чтобы вести семейный бюджет…" /></label>
        : <fieldset className="ob-choices"><legend className="sr-only">{QUESTIONS[step]}</legend>{choices.map(([value, title]) => {
          const selected = step === 1 ? profile.interest === value : step === 2 ? profile.experience === value :
            step === 3 ? profile.minutes === Number(value) : profile.format === value;
          return <label key={value} className={selected ? "ob-choice is-selected" : "ob-choice"}>
            <input type="radio" name="answer" value={value} checked={selected} onChange={() => {
              if (step === 1) update("interest", value as LearnerProfile["interest"]);
              if (step === 2) update("experience", value as LearnerProfile["experience"]);
              if (step === 3) update("minutes", Number(value) as LearnerProfile["minutes"]);
              if (step === 4) update("format", value as LearnerProfile["format"]);
            }} /><span>{title}</span><b aria-hidden="true">{selected ? "✓" : "→"}</b></label>;
        })}</fieldset>}
        {error && <p className="ob-error" role="alert">{error}</p>}
        <div className="ob-actions">{step > 0 && <button type="button" className="button secondary" onClick={() => { setStep(step - 1); setError(""); }}>Назад</button>}
          <button type="submit" className="button primary">{step === QUESTIONS.length - 1 ? "Составить маршрут" : "Продолжить"} →</button></div>
      </form>
    </div> : suggestion && <div className="ob-result">
      <span className="eyebrow">ТВОЙ ПРЕДВАРИТЕЛЬНЫЙ МАРШРУТ</span>
      <h3>{suggestion.subject === "math" ? "Математика" : suggestion.subject === "finance" ? "Финансы" : "Биология"}</h3>
      <p>{suggestion.reason}</p>
      {aiNote && <p className="ob-ai-note">{aiNote}</p>}
      <p className="ob-disclaimer">{suggestion.availability}</p>
      <ol className="ob-route">{suggestion.routeIds.map((id) => {
        const topic = getTopic(id);
        return topic ? <li key={id}><strong>{topic.title}</strong><span>{topic.assessment === "ready" ? "Урок и диагностика доступны" : "В разработке"}</span></li> : null;
      })}</ol>
      <div className="ob-actions">
        <button className="button primary" onClick={() => onOpenKnowledge(suggestion.topicId)}>Пройти первую диагностику →</button>
        <button className="button secondary" onClick={() => onOpenKnowledge(suggestion.routeIds[0] ?? suggestion.topicId)}>Открыть карту знаний</button>
      </div>
      <div className="ob-ai">
        <p>Можно уточнить маршрут через ИИ. В этом случае твои ответы будут отправлены сервером поставщику модели. Без этого шага рекомендации работают по правилам карты знаний.</p>
        <button className="button secondary" disabled={aiStatus === "loading"} onClick={() => void askAI()}>{aiStatus === "loading" ? "Анализируем…" : "Уточнить маршрут с ИИ"}</button>
        {aiStatus === "ai" && <small role="status">Рекомендация уточнена моделью. Уровень знаний пока не измерен.</small>}
        {aiStatus === "fallback" && <small role="status">Использован локальный алгоритм или предыдущий маршрут.</small>}
        {error && <p className="ob-error" role="alert">{error}</p>}
      </div>
      <button className="ob-reset" onClick={reset}>Удалить ответы и начать заново</button>
      <p className="ob-privacy">Ответы хранятся только в этом браузере. Это не оценка интеллекта, не экзамен и не профиль личности.</p>
    </div>}
  </section>;
}
