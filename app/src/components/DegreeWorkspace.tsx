import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AI_PROGRAM, COURSE_SOURCES, DEGREE_MODULES, MODULE_BY_ID, SOURCE_BY_ID,
  buildLessonLoop, estimateDuration, type LessonStageId,
} from "../lib/degree-programs";
import "./degree-workspace.css";

const STORAGE = "aiu:degree-workspace:v1";
type Saved = { weekly: number; selected: string; done: string[]; notes: Record<string, string>; studied: string[] };
const DEFAULT: Saved = { weekly: 20, selected: DEGREE_MODULES[0].id, done: [], notes: {}, studied: [] };
type SourceProposal = { id: string; title: string; status: "pending" | "approved" | "rejected" };

export function DegreeWorkspace({ onOpenTopic }: { onOpenTopic: (topicId: string) => void }) {
  const [value, setValue] = useState<Saved>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [activeStage, setActiveStage] = useState<LessonStageId>("lecture");
  const [minutes, setMinutes] = useState<15 | 30 | 60>(30);
  const [examMode, setExamMode] = useState(false);
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null);
  const [examAnswer, setExamAnswer] = useState("");
  const [examResult, setExamResult] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [proposalStatus, setProposalStatus] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);
  const [myProposals, setMyProposals] = useState<SourceProposal[]>([]);
  const [oracleQuestion, setOracleQuestion] = useState("");
  const [oracleAnswer, setOracleAnswer] = useState("");
  const [oracleBusy, setOracleBusy] = useState(false);

  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
      if (raw && typeof raw === "object") {
        const candidate = raw as Partial<Saved>;
        if (candidate.weekly && [5, 10, 15, 20, 30, 40].includes(candidate.weekly) &&
            typeof candidate.selected === "string" && MODULE_BY_ID.has(candidate.selected)) {
          setValue({
            weekly: candidate.weekly, selected: candidate.selected,
            done: Array.isArray(candidate.done) ? candidate.done.filter((x): x is string => typeof x === "string" && MODULE_BY_ID.has(x)).slice(0, 9) : [],
            studied: Array.isArray(candidate.studied) ? candidate.studied.filter((x): x is string => typeof x === "string").slice(0, 100) : [],
            notes: {},
          });
        }
      }
    } catch { /* Browser storage is optional. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE, JSON.stringify(value)); } catch { /* Memory-only mode. */ }
  }, [ready, value]);
  useEffect(() => {
    if (!examStartedAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [examStartedAt]);

  const module = MODULE_BY_ID.get(value.selected) ?? DEGREE_MODULES[0];
  const schedule = useMemo(() => estimateDuration(value.weekly), [value.weekly]);
  const loop = useMemo(() => buildLessonLoop(module, minutes), [module, minutes]);
  const examExpired = examStartedAt !== null && clock >= examStartedAt + module.exam.durationMinutes * 60_000;
  const examTimeLeft = examStartedAt ? Math.max(0, Math.ceil((examStartedAt + module.exam.durationMinutes * 60_000 - clock) / 60_000)) : 0;
  const stageKey = `${module.id}:${activeStage}`;
  const sources = module.sourceIds.flatMap((id) => {
    const source = SOURCE_BY_ID.get(id); return source ? [source] : [];
  });

  function chooseModule(id: string) {
    if (!MODULE_BY_ID.has(id)) return;
    setValue((prev) => ({ ...prev, selected: id }));
    setActiveStage("lecture");
    setExamMode(false); setExamStartedAt(null); setExamAnswer(""); setExamResult("");
    setOracleAnswer(""); setOracleQuestion("");
  }
  function markStudied() {
    const key = `${module.id}:${activeStage}`;
    setValue((prev) => ({ ...prev, studied: [...new Set([...prev.studied, key])] }));
    const currentIndex = loop.findIndex((stage) => stage.id === activeStage);
    if (currentIndex !== -1 && currentIndex + 1 < loop.length) setActiveStage(loop[currentIndex + 1].id);
  }
  function markModuleReviewed() {
    setValue((prev) => ({ ...prev, done: [...new Set([...prev.done, module.id])] }));
  }
  async function suggestSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProposalBusy(true); setProposalStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await fetch("/api/sources/proposals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"), institution: form.get("institution"),
          url: form.get("url"), rightsNote: form.get("rightsNote"),
        }),
      });
      const body = await result.json() as { error?: string; message?: string };
      if (!result.ok) throw new Error(body.error ?? "Не удалось отправить источник.");
      setProposalStatus(body.message ?? "Отправлено на модерацию.");
      (event.target as HTMLFormElement).reset();
      void refreshSources();
    } catch (e) {
      setProposalStatus(e instanceof Error ? e.message : "Не удалось отправить источник.");
    } finally { setProposalBusy(false); }
  }
  async function refreshSources() {
    try {
      const response = await fetch("/api/sources/proposals");
      const body = await response.json() as { proposals?: SourceProposal[] };
      if (response.ok && Array.isArray(body.proposals)) setMyProposals(body.proposals);
    } catch { /* Form still works without history. */ }
  }
  async function askOracle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (examMode || !oracleQuestion.trim()) return;
    setOracleBusy(true); setOracleAnswer("");
    try {
      const response = await fetch("/api/oracle/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: module.id, question: oracleQuestion.trim() }),
      });
      const body = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !body.answer) throw new Error(body.error ?? "Оракул временно недоступен.");
      setOracleAnswer(body.answer);
    } catch (e) {
      setOracleAnswer(e instanceof Error ? e.message : "Оракул временно недоступен.");
    } finally { setOracleBusy(false); }
  }
  function submitExam() {
    if (!examStartedAt || examExpired || examAnswer.trim().length < 30) {
      setExamResult(examExpired ? "Время истекло. Попытка не оценена." : "Опиши решение подробнее. Минимум 30 символов.");
      return;
    }
    // Never infer a score from free-form work or from self-reported adherence to no-AI rules.
    setExamResult("Тренировочная работа сохранена только в текущем окне. Оценки и диплома нет. Для подтверждения самостоятельности нужна отдельная проверка с преподавателем.");
    setExamStartedAt(null);
  }
  return <section className="dw" aria-label="Программа инженерии ИИ">
    <div className="dw-intro">
      <span className="eyebrow">НЕЗАВИСИМАЯ УЧЕБНАЯ ПРОГРАММА</span>
      <h2>{AI_PROGRAM.title}</h2>
      <p>{AI_PROGRAM.disclaimer}</p>
      <div className="dw-stats"><span>{DEGREE_MODULES.length} модулей</span><span>{COURSE_SOURCES.length} ссылок на университетские курсы</span><span>{schedule.totalHours} расчётных часов</span></div>
    </div>
    <div className="dw-schedule">
      <label>Сколько часов в неделю ты готов учиться?
        <select value={value.weekly} onChange={(e) => setValue((prev) => ({ ...prev, weekly: Number(e.target.value) }))}>
          {[5, 10, 15, 20, 30, 40].map((hours) => <option value={hours} key={hours}>{hours} ч/нед.</option>)}
        </select>
      </label>
      <p>Ориентир: <strong>{schedule.weeks} недель, около {schedule.months} месяцев</strong> при выбранной нагрузке, без учёта каникул и пересдач. Это оценка времени, не гарантия освоения.</p>
    </div>
    <div className="dw-layout">
      <nav aria-label="Модули AI-программы" className="dw-module-nav">
        {DEGREE_MODULES.map((item, index) => <button key={item.id} onClick={() => chooseModule(item.id)}
          className={item.id === module.id ? "dw-module current" : "dw-module"} aria-current={item.id === module.id ? "step" : undefined}>
          <small>МОДУЛЬ {index + 1}</small><strong>{item.title}</strong>
          <span>{item.expectedHours} ч. · {value.done.includes(item.id) ? "Просмотрено (самоотметка)" : "В маршруте"}</span>
        </button>)}
      </nav>
      <article className="dw-main">
        <div className="dw-main-header"><span className="eyebrow">ПЛАН МОДУЛЯ</span><h3>{module.title}</h3><p>{module.outcomes.join(" · ")}</p></div>
        {module.prerequisites.length > 0 && <p className="dw-prereqs">Рекомендуемые предпосылки: {module.prerequisites.map((id) => MODULE_BY_ID.get(id)?.title).filter(Boolean).join(", ")}.</p>}
        <section className="dw-sources" aria-label="Источники курса"><h4>Университетские источники</h4>
          {sources.length ? sources.map((source) => <div className="dw-source" key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.university}: {source.title} ↗</a>
            <small>{source.accessNote}</small>
          </div>) : <p>Итоговый проект использует ранее освоенные материалы; собственного внешнего курса нет.</p>}
          <p className="dw-footnote">Материалы находятся у правообладателей. Мы не копируем видеолекции и не выдаём университетский диплом.</p>
        </section>
        {!examMode ? <>
          <div className="dw-session"><h4>Учебный цикл</h4><label>Одна сессия: <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value) as 15 | 30 | 60)}><option value={15}>15 минут</option><option value={30}>30 минут</option><option value={60}>60 минут</option></select></label></div>
          <div className="dw-stage-tabs" aria-label="Этапы урока">{loop.map((stage) => <button key={stage.id} onClick={() => setActiveStage(stage.id)} className={stage.id === activeStage ? "is-active" : ""}>
            {stage.title} · {stage.minutes} мин. {value.studied.includes(`${module.id}:${stage.id}`) ? "✓" : ""}
          </button>)}</div>
          <div className="dw-stage"><h4>{loop.find((stage) => stage.id === activeStage)?.title}</h4>
            <p>{loop.find((stage) => stage.id === activeStage)?.instruction}</p>
            {activeStage === "seminar" && <p><strong>Практика:</strong> {module.project}</p>}
            {activeStage === "check" && module.curriculumTopicId &&
              <button className="button secondary" onClick={() => onOpenTopic(module.curriculumTopicId!)}>Открыть существующую диагностику →</button>}
            {activeStage === "check" && !module.curriculumTopicId && <p>Автоматическая независимая проверка этого модуля ещё не готова.</p>}
            {activeStage === "summary" && <label>Твой конспект <textarea value={value.notes[stageKey] ?? ""} maxLength={5000} rows={5}
              onChange={(e) => setValue((prev) => ({ ...prev, notes: { ...prev.notes, [stageKey]: e.target.value } }))} placeholder="Сформулируй главные мысли своими словами…" /></label>}
            <div className="dw-actions"><button className="button primary" onClick={markStudied}>Отметить этап как изученный →</button></div>
          </div>
          <section className="dw-oracle" aria-label="Оракул"><h4>Оракул: спроси о теме</h4>
            <p>ИИ поможет объяснить непонятное, но не заменяет независимую проверку знания. Вопрос отправляется внешней модели только после нажатия кнопки.</p>
            <form onSubmit={askOracle}><label><span className="sr-only">Вопрос по модулю</span><textarea value={oracleQuestion} maxLength={1500} rows={3} required placeholder="Например: почему собственные векторы важны в машинном обучении?" onChange={(e) => setOracleQuestion(e.target.value)} /></label>
              <button className="button secondary" disabled={oracleBusy}>{oracleBusy ? "Объясняем…" : "Спросить ИИ"}</button></form>
            {oracleAnswer && <p className="dw-oracle-answer" role="status">{oracleAnswer}</p>}
          </section>
          <div className="dw-actions"><button className="button secondary" onClick={markModuleReviewed}>Я ознакомился с модулем (самоотметка)</button>
            <button className="button primary" onClick={() => { setExamMode(true); setExamStartedAt(null); setExamAnswer(""); setExamResult(""); }}>Тренировочный экзамен →</button></div>
        </> : <section className="dw-exam" aria-label="Экзамен по модулю">
          <span className="eyebrow">ТРЕНИРОВОЧНЫЙ ЭКЗАМЕН</span><h4>{module.title}</h4>
          <p>Формат: {module.exam.type}. Время: {module.exam.durationMinutes} минут. Для подлинного экзамена требуется отдельный проверяющий. В браузере нельзя надёжно исключить использование ИИ или посторонней помощи.</p>
          <p><strong>Правило экзамена:</strong> выполнять работу самостоятельно, без нейросетей и генераторов кода. Оракул скрыт в режиме экзамена. Это ограничение интерфейса, не система прокторинга.</p>
          {!examStartedAt && !examResult && <button className="button primary" onClick={() => { setExamStartedAt(Date.now()); setClock(Date.now()); }}>Начать тренировочную попытку</button>}
          {examStartedAt && <><p role="timer">Осталось около {examTimeLeft} мин.</p>
            <ol>{module.exam.tasks.map((task) => <li key={task}>{task}</li>)}</ol>
            <label>Твой ответ / код / план решения<textarea value={examAnswer} onChange={(e) => setExamAnswer(e.target.value)} maxLength={30000} rows={10} placeholder="Работа проверяется человеком, автоматическая оценка не производится." /></label>
            <button className="button primary" onClick={submitExam}>Завершить тренировку без оценки</button></>}
          {examResult && <p role="status">{examResult}</p>}
          <h5>Критерии проверки</h5><ul>{module.exam.rubric.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
          <button className="button secondary" onClick={() => { setExamMode(false); setExamStartedAt(null); }}>Вернуться к уроку</button>
        </section>}
      </article>
    </div>
    <div className="dw-contribute"><h3>Предложить новый источник</h3>
      <p>Ученики могут предложить лекцию, курс или учебник. Публикация возможна только после проверки качества, доступа и прав.</p>
      <button className="button secondary" onClick={() => { setSourcesOpen(!sourcesOpen); if (!sourcesOpen) void refreshSources(); }}>{sourcesOpen ? "Скрыть форму" : "Добавить источник"} →</button>
      {sourcesOpen && <form onSubmit={suggestSource} className="dw-form">
        <label>Название курса<input name="title" minLength={4} maxLength={180} required placeholder="Например, Algorithms" /></label>
        <label>Университет / автор<input name="institution" minLength={2} maxLength={120} required /></label>
        <label>Официальная HTTPS-ссылка<input name="url" type="url" pattern="https://.*" maxLength={1600} required placeholder="https://…" /></label>
        <label>Что известно о доступе и правах?<textarea name="rightsNote" rows={3} minLength={2} maxLength={350} required placeholder="Например: лекции доступны для просмотра на сайте университета; права на копирование не подтверждены." /></label>
        <button className="button primary" disabled={proposalBusy}>{proposalBusy ? "Отправка…" : "Отправить на модерацию"}</button>
        {proposalStatus && <p role="status">{proposalStatus}</p>}
        {myProposals.length > 0 && <div><h4>Мои заявки</h4>{myProposals.map((item) => <p key={item.id}>{item.title}: {item.status === "pending" ? "ожидает проверки" : item.status === "approved" ? "одобрена" : "отклонена"}</p>)}</div>}
      </form>}
    </div>
    <p className="dw-footnote">Вся история этапов здесь является самоотметкой в данном браузере, не официальным учебным прогрессом. Экзаменационные ответы не отправляются преподавателю. Аккредитация и удостоверение личности не реализованы.</p>
  </section>;
}
