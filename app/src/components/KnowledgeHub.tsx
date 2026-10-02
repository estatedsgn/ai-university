import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AssessmentPlayer } from "./AssessmentPlayer";
import { MaterialsStudio } from "./MaterialsStudio";
import { SUBJECTS, TOPICS, getTopic, getAvailability, getPrerequisites, getNextTopics } from "../lib/curriculum";
import type { AssessmentMode, MaterialPublic, SubjectId, Topic, TopicLevel, TopicProgress } from "../lib/learning-types";
import "../knowledge-hub.css";

type Tab = "topics" | "materials" | "checks" | "accreditation";
type AssessmentTarget = { topicId?: string; materialId?: string; title: string; initialMode?: AssessmentMode };
const LEVELS: Record<TopicLevel, string> = {
  foundation: "Основы", school: "Школьный уровень",
  university: "Университет", advanced: "Продвинутый уровень",
};
const TABS: { id: Tab; title: string }[] = [
  { id: "topics", title: "Темы" }, { id: "materials", title: "Мои материалы" },
  { id: "checks", title: "Как проверяем" }, { id: "accreditation", title: "Аккредитация" },
];
const EXAMPLE_PATH = ["math-arithmetic", "math-fractions", "math-percent", "math-linear-equations", "math-functions", "math-derivatives", "math-integrals"];
const STAGES = [
  ["Разобраться", "Короткое объяснение, пример и типичная ошибка."],
  ["Попробовать", "Решить задачу и получить обратную связь."],
  ["Объяснить", "Сформулировать ход решения своими словами."],
  ["Применить", "Отдельная проверка в новой ситуации."],
  ["Вернуться", "Повторить через 1, 3, 7, 14 и 30 дней."],
];
function Arrow() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5" /></svg>;
}
function progressLabel(progress?: TopicProgress) {
  if (!progress || !progress.attempts) return "Ещё не проверяли";
  if (progress.status === "review") return "Пора повторить";
  if (progress.diagnosticPassed && progress.transferPassed) return "Основа подтверждена";
  if (progress.diagnosticPassed) return "Нужна проверка применения";
  return "Есть что потренировать";
}
function dateLabel(value: number) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
export function KnowledgeHub() {
  const [tab, setTab] = useState<Tab>("topics");
  const [subject, setSubject] = useState<SubjectId>("math");
  const [selectedId, setSelectedId] = useState("math-arithmetic");
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [level, setLevel] = useState("");
  const [onlyReady, setOnlyReady] = useState(false);
  const [progress, setProgress] = useState<TopicProgress[]>([]);
  const [today, setToday] = useState(Date.now);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [assessment, setAssessment] = useState<AssessmentTarget | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLHeadingElement>(null);
  const refreshProgress = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgressLoading(true);
    setProgressError("");
    try {
      const response = await fetch("/api/learning/progress", { signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Не удалось загрузить прогресс.");
      if (!Array.isArray(body.progress)) throw new Error("Сервер вернул неполный прогресс.");
      if (!controller.signal.aborted) {
        setProgress(body.progress);
        setToday(typeof body.today === "number" ? body.today : Date.now());
      }
    } catch (error) {
      if (!controller.signal.aborted) setProgressError(error instanceof Error ? error.message : "Не удалось загрузить прогресс.");
    } finally {
      if (!controller.signal.aborted) setProgressLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshProgress();
    try {
      const saved = localStorage.getItem("aiu-knowledge-subject");
      if (SUBJECTS.some((item) => item.id === saved)) {
        const next = saved as SubjectId;
        setSubject(next);
        const first = TOPICS.find((item) => item.subjectId === next);
        if (first) setSelectedId(first.id);
      }
    } catch { /* Choosing a subject does not require browser storage. */ }
    if (new URLSearchParams(window.location.search).has("material")) setTab("materials");
    return () => abortRef.current?.abort();
  }, [refreshProgress]);
  const progressById = useMemo(() => new Map(progress.map((item) => [item.topicId, item])), [progress]);
  const subjectTopics = TOPICS.filter((item) => item.subjectId === subject);
  const branches = [...new Set(subjectTopics.map((item) => item.branch))];
  const levels = [...new Set(subjectTopics.map((item) => item.level))];
  const filtered = subjectTopics.filter((item) =>
    (!branch || item.branch === branch) && (!level || item.level === level) &&
    (!onlyReady || item.assessment === "ready") &&
    `${item.title} ${item.branch} ${item.outcomes.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected = getTopic(selectedId) || subjectTopics[0];
  const due = progress.filter((item) => item.nextReviewAt !== null && item.nextReviewAt <= today && getTopic(item.topicId)?.assessment === "ready");
  const checked = progress.filter((item) => item.diagnosticPassed && item.transferPassed).length;
  const readyCount = subjectTopics.filter((item) => item.assessment === "ready").length;
  const currentSubject = SUBJECTS.find((item) => item.id === subject);
  function chooseSubject(next: SubjectId) {
    setSubject(next); setSearch(""); setBranch(""); setLevel(""); setOnlyReady(false);
    const first = TOPICS.find((item) => item.subjectId === next);
    if (first) setSelectedId(first.id);
    try { localStorage.setItem("aiu-knowledge-subject", next); } catch {}
  }
  function chooseTopic(id: string) {
    const topic = getTopic(id);
    if (!topic) return;
    if (topic.subjectId !== subject) {
      setSubject(topic.subjectId); setBranch(""); setLevel(""); setOnlyReady(false); setSearch("");
    }
    setSelectedId(id); setTab("topics");
    requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 900px)").matches) detailRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
  function startTopic(topic: Topic, initialMode: AssessmentMode = "diagnostic") {
    setAssessment({ topicId: topic.id, title: topic.title, initialMode });
  }
  function startMaterial(material: MaterialPublic) {
    setAssessment({ materialId: material.id, title: material.title });
  }
  function downloadCurriculum() {
    setDownloadError("");
    try {
      const file = {
        kind: "curriculum-draft", version: 1, exportedAt: new Date().toISOString(),
        notice: "Черновик учебной программы. Не является аккредитацией или основанием для выдачи диплома.",
        subjects: SUBJECTS,
        topics: TOPICS.map(({ id, subjectId, title, branch: topicBranch, level: topicLevel, prerequisites, outcomes, minutes, assessment: readiness }) =>
          ({ id, subjectId, title, branch: topicBranch, level: topicLevel, prerequisites, outcomes, minutes, assessment: readiness })),
        assessmentPolicy: { thresholdPercent: 80, separateTransferRequired: true, retries: "unlimited", accreditation: false },
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "ai-university-curriculum-draft.json";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError("Не удалось скачать программу. Попробуй ещё раз."); }
  }
  if (assessment) {
    return <section className="kh kh-assessment" aria-label="Проверка знаний">
      <AssessmentPlayer {...assessment} onComplete={() => void refreshProgress()} onClose={() => setAssessment(null)} />
    </section>;
  }
  return <section className="kh" aria-label="Карта знаний">
    <div className="kh-intro">
      <div>
        <span className="kh-eyebrow">ОДНО ЗНАНИЕ ОТКРЫВАЕТ СЛЕДУЮЩЕЕ</span>
        <h2>От «не понимаю» к «могу применить»</h2>
        <p>Выбери направление, проверь знакомую тему или принеси свой материал. Карта покажет, на что опереться и куда идти дальше.</p>
      </div>
      <div className="kh-symbol" aria-hidden="true"><span>1</span><i /><span>x</span><i /><span>∫</span></div>
    </div>
    <nav className="kh-tabs" aria-label="Разделы карты знаний">
      {TABS.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "is-active" : ""} aria-current={tab === item.id ? "page" : undefined}>{item.title}</button>)}
    </nav>
    {tab === "topics" && <>
      <div className="kh-subject-heading"><div><span className="kh-eyebrow">ГДЕ ХОЧЕШЬ ПРИМЕНИТЬ ЗНАНИЯ?</span><h3>Выбери свой маршрут</h3></div><span className="kh-muted">Темп и число попыток выбираешь ты</span></div>
      <div className="kh-subjects">
        {SUBJECTS.map((item) => {
          const count = TOPICS.filter((topic) => topic.subjectId === item.id).length;
          const ready = TOPICS.filter((topic) => topic.subjectId === item.id && topic.assessment === "ready").length;
          return <button key={item.id} className={`kh-subject ${subject === item.id ? "is-active" : ""}`} aria-pressed={subject === item.id} onClick={() => chooseSubject(item.id)}>
            <span className="kh-subject-icon" aria-hidden="true">{item.id === "math" ? "∑" : item.id === "finance" ? "%" : "✳"}</span>
            <span><strong>{item.title}</strong><span className="kh-subject-description">{item.description}</span><small>{count} тем в карте · {ready ? `${ready} с проверкой сейчас` : "Содержание в плане"}</small></span>
            <Arrow />
          </button>;
        })}
      </div>
      <div className="kh-route">
        <div><span className="kh-eyebrow">ПРИМЕР ПУТИ В МАТЕМАТИКЕ</span><p>Это ориентир. Все связи конкретной темы показаны ниже.</p></div>
        <ol aria-label="Пример последовательности тем">{EXAMPLE_PATH.map((id, index) => {
          const topic = getTopic(id);
          return topic ? <li key={id}><button onClick={() => chooseTopic(id)}>{topic.title}</button>{index < EXAMPLE_PATH.length - 1 && <span aria-hidden="true">→</span>}</li> : null;
        })}</ol>
      </div>
      <div className="kh-progress-line" role="status" aria-live="polite">
        {progressLoading ? <p>Загружаем твой прогресс…</p> : progressError ? <><p>{progressError}</p><button onClick={() => void refreshProgress()}>Попробовать снова</button></> : <>
          <p><strong>{checked}</strong> тем с подтверждённой основой · <strong>{due.length}</strong> ждут повторения</p>
          <span>Прогресс связан с этим браузером. Аккаунты и перенос между устройствами пока не подключены.</span>
        </>}
      </div>
      {!progressLoading && !progressError && due.length > 0 && <section className="kh-review" aria-label="Утренний обзор">
        <div><span className="kh-eyebrow">УТРЕННИЙ ОБЗОР</span><h3>Коротко вернёмся к знакомому</h3><p>Повтори, когда удобно. Пропуск не отнимает уже открытые темы.</p></div>
        <div className="kh-link-list">{due.slice(0, 4).map((item) => <button key={item.topicId} onClick={() => chooseTopic(item.topicId)}>{getTopic(item.topicId)?.title}<Arrow /></button>)}</div>
        {due.length > 4 && <p className="kh-muted">И ещё {due.length - 4}. Пометка «Пора повторить» есть на карточках.</p>}
      </section>}
      <div className="kh-map-heading"><div><span className="kh-eyebrow">{currentSubject?.title.toUpperCase()}</span><h3>Карта основных ветвей</h3><p>{readyCount ? `Проверки доступны для ${readyCount} тем. Остальные — открытый план развития программы.` : "Связи и результаты обучения уже описаны. Уроки и проверки этого направления ещё в плане."}</p></div></div>
      <div className="kh-filters">
        <label className="kh-search"><span className="sr-only">Найти тему</span><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название темы или навык" /></label>
        <label><span className="sr-only">Ветвь предмета</span><select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="">Все ветви</option>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">Уровень сложности</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Все уровни</option>{levels.map((item) => <option key={item} value={item}>{LEVELS[item]}</option>)}</select></label>
        <label className="kh-checkbox"><input type="checkbox" checked={onlyReady} onChange={(event) => setOnlyReady(event.target.checked)} />С проверкой</label>
      </div>
      <div className="kh-map">
        <div className="kh-topic-list">
          <p className="kh-list-count">{filtered.length} из {subjectTopics.length} тем</p>
          {filtered.length ? branches.filter((item) => filtered.some((topic) => topic.branch === item)).map((item) => <section className="kh-branch" key={item} aria-label={item}><h4>{item}</h4><ul>{filtered.filter((topic) => topic.branch === item).map((topic) => {
            const itemProgress = progressById.get(topic.id);
            const availability = getAvailability(topic, progress);
            const ready = topic.assessment === "ready";
            return <li key={topic.id}><button className={`kh-topic ${selected?.id === topic.id ? "is-selected" : ""}`} onClick={() => chooseTopic(topic.id)} aria-pressed={selected?.id === topic.id}>
              <span className={`kh-topic-dot ${ready ? itemProgress?.diagnosticPassed && itemProgress.transferPassed ? "done" : "available" : "planned"}`} aria-hidden="true">{ready && itemProgress?.diagnosticPassed && itemProgress.transferPassed ? "✓" : ""}</span>
              <span className="kh-topic-copy"><strong>{topic.title}</strong><small>{LEVELS[topic.level]} · {ready ? `${topic.minutes} мин.` : "В плане"}</small><span className="kh-topic-state">{!ready ? "Урок и тест ещё не опубликованы" : itemProgress?.attempts ? progressLabel(itemProgress) : availability.unlocked ? "Можно начать" : "Можно проверить прежние знания"}</span></span>
              <span className="kh-topic-arrow" aria-hidden="true">›</span>
            </button></li>;
          })}</ul></section>) : <div className="kh-empty"><h4>Пока ничего не нашли</h4><p>Измени запрос или посмотри темы без фильтров.</p><button className="button secondary" onClick={() => { setSearch(""); setBranch(""); setLevel(""); setOnlyReady(false); }}>Сбросить фильтры</button></div>}
        </div>
        {selected && <TopicDetail topic={selected} progress={progressById.get(selected.id)} allProgress={progress} progressLoading={progressLoading} progressError={progressError} headingRef={detailRef} onSelect={chooseTopic} onStart={startTopic} />}
      </div>
      <p className="kh-footnote">Карта охватывает основные направления, а не все существующие разделы науки. Математические основы переиспользуются в финансах и биологии: зависимости между предметами тоже видны в теме.</p>
    </>}
    {tab === "materials" && <MaterialsStudio onStartQuiz={startMaterial} />}
    {tab === "checks" && <section className="kh-info">
      <span className="kh-eyebrow">УВЕРЕННОСТЬ ПОДКРЕПЛЯЕМ ПРАКТИКОЙ</span>
      <h3>Знать ответ и понимать тему — разные навыки</h3>
      <p>Диагностика показывает стартовую точку. Тренировка даёт объяснения. Отдельная проверка применения помогает понять, получается ли решить новую задачу.</p>
      <ol className="kh-cycle">{STAGES.map(([title, description], index) => <li key={title}><span>{index + 1}</span><div><h4>{title}</h4><p>{description}</p></div></li>)}</ol>
      <div className="kh-info-grid">
        <article><h4>Когда открывается следующая ступень?</h4><p>Нужно набрать минимум 80% в диагностике и отдельно 80% в проверке применения каждой базовой темы. Знакомую тему можно диагностировать сразу. Тренировка и применение зависят от подтверждённых предпосылок.</p></article>
        <article><h4>Можно возвращаться сколько угодно</h4><p>Попытки не ограничены. Таймер включается по желанию и не определяет ценность ученика. После подтверждения основы начинается цикл повторений; пропущенная дата не блокирует движение.</p></article>
        <article><h4>Как снижаем случайное угадывание</h4><p>Ответ проверяется на сервере. Один верный вариант не открывает тему: нужна отдельная проверка применения. Объяснение решения даёт дополнительный материал для обсуждения, но сейчас не оценивается автоматически.</p></article>
        <article><h4>Как относимся к списыванию</h4><p>Быстрый ответ и таймер не доказывают отсутствие помощи. Этот пилот не проводит прокторинг и не удостоверяет личность. Для формального результата потребуются отдельные процедуры: проверяющий, объяснение решения и перенос навыка в новую задачу.</p></article>
      </div>
      <div className="kh-notice"><strong>Результат теста — учебный сигнал.</strong><p>Он помогает выбрать следующий шаг. Это не государственный экзамен, подтверждение квалификации или гарантия полного знания предмета.</p></div>
      <button className="button primary" onClick={() => setTab("topics")}>Выбрать первую тему <Arrow /></button>
    </section>}
    {tab === "accreditation" && <section className="kh-info">
      <span className="kh-eyebrow">ОТ УЧЕБНОГО ПИЛОТА К ФОРМАЛЬНОЙ ПРОГРАММЕ</span>
      <h3>Аккредитация — отдельный путь</h3>
      <p>Сейчас AI Университет — учебный пилот. Государственной аккредитации нет; право выдавать государственные дипломы не заявлено. Страна, организация и стандарт программы ещё не выбраны.</p>
      <div className="kh-notice"><strong>Карта помогает подготовить программу.</strong><p>Темы, зависимости, результаты обучения и ориентиры по времени можно выгрузить. Это черновик для работы с методистом и профильными специалистами; сам файл не даёт аккредитации.</p></div>
      <ol className="kh-accreditation-steps">
        <li><strong>Выбрать страну и формат организации</strong><p>Уточнить, какой орган регулирует обучение и какие разрешения нужны именно этому формату.</p></li>
        <li><strong>Описать образовательную программу</strong><p>Установить требования к приёму, объём обучения, результаты, преподавателей и систему оценки.</p></li>
        <li><strong>Организовать проверяемое обучение</strong><p>Подготовить учёт достижений, процедуры проверки личности и самостоятельности, работу с данными и доступность.</p></li>
        <li><strong>Проверить требования и подать документы</strong><p>Согласовать план с профильными специалистами и компетентным органом. Сроки и возможность аккредитации зависят от выбранной юрисдикции.</p></li>
      </ol>
      <button className="button secondary" onClick={downloadCurriculum}>Скачать черновик программы (.json) <Arrow /></button>
      {downloadError && <p className="kh-error" role="alert">{downloadError}</p>}
      <p className="kh-footnote">В выгрузке только предметы, темы и правила учебных проверок. Личные результаты и ответы в неё не входят.</p>
    </section>}
  </section>;
}

function TopicDetail({ topic, progress, allProgress, progressLoading, progressError, headingRef, onSelect, onStart }: {
  topic: Topic; progress?: TopicProgress; allProgress: TopicProgress[]; progressLoading: boolean; progressError: string;
  headingRef: RefObject<HTMLHeadingElement | null>; onSelect: (id: string) => void; onStart: (topic: Topic, mode?: AssessmentMode) => void;
}) {
  const availability = getAvailability(topic, allProgress);
  const prerequisites = getPrerequisites(topic.id);
  const next = getNextTopics(topic.id);
  const ready = topic.assessment === "ready";
  const dataUnavailable = progressLoading || !!progressError;
  return <article className="kh-detail" aria-labelledby="kh-topic-title">
    <div className="kh-detail-head"><span className="kh-eyebrow">{topic.branch}</span><span className={`kh-badge ${ready ? "" : "planned"}`}>{ready ? "Урок и проверка" : "План программы"}</span></div>
    <h3 id="kh-topic-title" tabIndex={-1} ref={headingRef}>{topic.title}</h3>
    <p className="kh-detail-meta">{LEVELS[topic.level]} · Ориентир {topic.minutes} минут</p>
    <div className="kh-outcomes"><h4>После этой темы сможешь</h4><ul>{topic.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul></div>
    {topic.lesson && <section className="kh-lesson"><h4>Понять основу</h4><p>{topic.lesson.explanation}</p><div><strong>На примере</strong><p>{topic.lesson.example}</p></div><aside><strong>Частая ошибка</strong><p>{topic.lesson.commonMistake}</p></aside></section>}
    {!ready && <div className="kh-notice"><strong>Эта тема ещё в плане.</strong><p>Пока доступны её место в программе, предпосылки и результаты обучения. Опубликованных урока и теста здесь ещё нет.</p></div>}
    <section className="kh-dependencies"><h4>На что опирается</h4>{prerequisites.length ? <div className="kh-link-list">{prerequisites.map((item) => {
      const result = allProgress.find((entry) => entry.topicId === item.id);
      const done = result?.diagnosticPassed && result.transferPassed;
      return <button key={item.id} onClick={() => onSelect(item.id)}><span><strong>{item.title}</strong><small>{dataUnavailable ? "Прогресс не загружен" : done ? "Основа подтверждена" : "Нужна диагностика и применение"}{item.subjectId !== topic.subjectId ? ` · ${SUBJECTS.find((subject) => subject.id === item.subjectId)?.title}` : ""}</small></span><Arrow /></button>;
    })}</div> : <p className="kh-muted">Можно начать здесь: обязательных предыдущих тем нет.</p>}</section>
    {ready && <>
      <div className="kh-readiness"><span className="kh-eyebrow">ТВОЯ УВЕРЕННОСТЬ В ТЕМЕ</span><strong>{progressError ? "Прогресс не загружен" : progressLoading ? "Проверяем прогресс…" : progressLabel(progress)}</strong>{!dataUnavailable && progress?.attempts ? <p>{progress.attempts} попыток · лучший учебный результат {progress.bestScore}%{progress.nextReviewAt ? ` · следующий обзор ${dateLabel(progress.nextReviewAt)}` : ""}</p> : !dataUnavailable ? <p>Начни с диагностики. Ошибка подскажет, что повторить.</p> : null}</div>
      <div className="kh-detail-actions"><button className="button primary" onClick={() => onStart(topic)}>Проверить, что уже знаю <Arrow /></button><button className="button secondary" disabled={!availability.unlocked || dataUnavailable} onClick={() => onStart(topic, "practice")}>Тренироваться</button><button className="button secondary" disabled={!availability.unlocked || dataUnavailable} onClick={() => onStart(topic, "transfer")}>Применить в новой задаче</button></div>
      <p className="kh-action-note">{dataUnavailable ? "Диагностика доступна; тренировка появится после загрузки прогресса." : !availability.unlocked ? `Для тренировки подтверди базовые темы: ${availability.missing.map((item) => item.title).join(", ")}. Диагностику знакомой темы можно пройти сейчас.` : "Внутри выбери диагностику, тренировку или отдельную проверку применения. Попытки не ограничены."}</p>
    </>}
    <section className="kh-dependencies kh-next"><h4>Куда можно двигаться дальше</h4>{next.length ? <div className="kh-link-list">{next.map((item) => <button key={item.id} onClick={() => onSelect(item.id)}><span><strong>{item.title}</strong><small>{SUBJECTS.find((subject) => subject.id === item.subjectId)?.title} · {item.assessment === "ready" ? "Есть проверка" : "В плане"}</small></span><Arrow /></button>)}</div> : <p className="kh-muted">Следующие связи этой ветви пока не добавлены.</p>}</section>
  </article>;
}
