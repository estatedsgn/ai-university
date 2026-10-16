/**
 * Author-authored AI study pathway, not a university degree, licence, or promise of equivalence.
 * University links are references. We never copy or mirror their content without permissions.
 */
export type SourceStatus = "public-link" | "restricted-link" | "pending-review";
export type CourseSource = {
  id: string; university: string; title: string; url: string;
  status: SourceStatus; accessNote: string; rights: "link-only"; verifiedAt: string;
};
export type LessonStageId =
  | "lecture" | "summary" | "seminar" | "explain" | "practice" | "check" | "review";
export type LessonStage = { id: LessonStageId; title: string; instruction: string; minutes: number; required: boolean };
export type ExamBlueprint = {
  type: "written" | "coding" | "practical" | "oral";
  durationMinutes: number; tasks: string[];
  allowedAssistance: "none"; supervision: "verified-proctor-required";
  rubric: string[];
};
export type DegreeModule = {
  id: string; title: string; expectedHours: number; prerequisites: string[];
  sourceIds: string[]; outcomes: string[]; seminar: boolean; project: string;
  curriculumTopicId?: string; exam: ExamBlueprint;
};
export type DegreeProgram = { id: string; title: string; disclaimer: string; moduleIds: string[] };

export const COURSE_SOURCES: CourseSource[] = [
  { id: "mit-1806", university: "MIT", title: "18.06 Linear Algebra", url: "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/",
    status: "public-link", rights: "link-only", verifiedAt: "2026-10-17", accessNote: "MIT OpenCourseWare: видео, задачи и экзамены; открывай материалы на MIT." },
  { id: "mit-6042", university: "MIT", title: "6.042J Mathematics for Computer Science", url: "https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/",
    status: "public-link", rights: "link-only", verifiedAt: "2026-10-17", accessNote: "MIT OpenCourseWare: дискретная математика, конспекты и задания." },
  { id: "harvard-cs50", university: "Harvard", title: "CS50x Introduction to Computer Science", url: "https://cs50.harvard.edu/x/",
    status: "public-link", rights: "link-only", verifiedAt: "2026-10-17", accessNote: "Открытая версия CS50; сертификаты университета или платной платформы не выдаются этим проектом." },
  { id: "stanford-cs229", university: "Stanford", title: "CS229 Machine Learning", url: "https://cs229.stanford.edu/",
    status: "restricted-link", rights: "link-only", verifiedAt: "2026-10-17", accessNote: "Описание программы открыто, но актуальные материалы CS229 могут требовать Stanford-аккаунт." },
  { id: "mit-6s191", university: "MIT", title: "6.S191 Introduction to Deep Learning", url: "https://introtodeeplearning.com/",
    status: "public-link", rights: "link-only", verifiedAt: "2026-10-17", accessNote: "Официальные видео, слайды и лабораторные; доступность отдельных материалов может меняться." },
  { id: "berkeley-cs188", university: "UC Berkeley", title: "CS188 Introduction to Artificial Intelligence", url: "https://inst.eecs.berkeley.edu/~cs188/fa26/",
    status: "public-link", rights: "link-only", verifiedAt: "2026-10-17", accessNote: "Официальный календарь с публичными материалами. Некоторые записи доступны только зачисленным." },
];

function exam(type: ExamBlueprint["type"], durationMinutes: number, tasks: string[], rubric: string[]): ExamBlueprint {
  return { type, durationMinutes, tasks, rubric, allowedAssistance: "none", supervision: "verified-proctor-required" };
}

export const DEGREE_MODULES: DegreeModule[] = [
  {
    id: "programming", title: "Программирование и алгоритмы", expectedHours: 220, prerequisites: [],
    sourceIds: ["harvard-cs50"], seminar: true,
    outcomes: ["Реализовать алгоритмы на Python", "Писать тесты и анализировать сложность"],
    project: "Напиши небольшой анализатор CSV без генерации кода ИИ.",
    exam: exam("coding", 180, ["Реализуй программу по новой спецификации.", "Добавь тесты для граничных случаев.", "Объясни сложность решения."],
      ["Корректность и тестирование", "Структура кода и ясность решений", "Обоснование сложности без ИИ"]),
  },
  {
    id: "discrete-math", title: "Дискретная математика и логика", expectedHours: 190, prerequisites: [],
    sourceIds: ["mit-6042"], seminar: true,
    outcomes: ["Строить доказательства", "Работать с графами, комбинаторикой и вероятностями"],
    project: "Разбери алгоритм обхода графа и докажи корректность.",
    curriculumTopicId: "math-combinatorics",
    exam: exam("written", 120, ["Докажи корректность алгоритма на графе.", "Реши задачу по комбинаторике и обоснуй ответ."],
      ["Корректность доказательств", "Самостоятельный вывод", "Понятность обоснования"]),
  },
  {
    id: "linear-algebra", title: "Линейная алгебра", expectedHours: 200, prerequisites: [],
    sourceIds: ["mit-1806"], seminar: true,
    outcomes: ["Решать системы уравнений", "Использовать векторы и матрицы", "Понимать собственные значения"],
    project: "Реализуй умножение матриц и проверь результаты на примерах.",
    curriculumTopicId: "math-vectors",
    exam: exam("written", 120, ["Реши новую систему линейных уравнений.", "Найди собственные значения малой матрицы.", "Объясни геометрический смысл результата."],
      ["Правильность вычислений", "Метод и математическое объяснение", "Независимое решение"]),
  },
  {
    id: "calculus-probability", title: "Анализ, вероятность и статистика", expectedHours: 240,
    prerequisites: ["discrete-math"], sourceIds: ["mit-6042"], seminar: true,
    outcomes: ["Находить производные и градиенты", "Оценивать вероятности", "Проверять статистические гипотезы"],
    project: "Оцени неопределённость результатов эксперимента на небольшом наборе данных.",
    curriculumTopicId: "math-statistics",
    exam: exam("written", 150, ["Рассчитай градиент функции.", "Построй вероятностную модель.", "Объясни доверительный интервал."],
      ["Расчёты", "Корректная интерпретация", "Самостоятельность"]),
  },
  {
    id: "software-engineering", title: "Разработка и инженерия программ", expectedHours: 220,
    prerequisites: ["programming"], sourceIds: ["harvard-cs50"], seminar: true,
    outcomes: ["Проектировать сервисы и API", "Развёртывать и тестировать приложения", "Разбираться с безопасностью"],
    project: "Разработай API с хранилищем, тестами и документацией.",
    exam: exam("coding", 240, ["Напиши работающий сервис по выданному техническому заданию.", "Добавь автоматические тесты.", "Проведи устную защиту архитектуры."],
      ["Работающий код", "Надёжность и тесты", "Архитектурное обоснование"]),
  },
  {
    id: "machine-learning", title: "Классическое машинное обучение", expectedHours: 250,
    prerequisites: ["programming", "linear-algebra", "calculus-probability"],
    sourceIds: ["stanford-cs229"], seminar: true,
    outcomes: ["Обучать и оценивать модели", "Различать переобучение и утечки данных", "Объяснять базовые оптимизаторы"],
    project: "Обучи собственную модель на открытом датасете с корректной валидацией.",
    exam: exam("practical", 240, ["Обучи базовую модель на новом наборе данных без автогенерации кода.", "Защити выбор метрик и процедуру валидации."],
      ["Чистая методология", "Репродуцируемость", "Осмысленная оценка ошибок"]),
  },
  {
    id: "artificial-intelligence", title: "Поиск, планирование и агенты", expectedHours: 210,
    prerequisites: ["programming", "discrete-math"], sourceIds: ["berkeley-cs188"], seminar: true,
    outcomes: ["Реализовать алгоритмы поиска", "Применять вероятностные модели", "Оценивать планы и действия агентов"],
    project: "Создай решатель задачи поиска с эвристикой.",
    exam: exam("coding", 180, ["Реализуй алгоритм A* на новой карте.", "Докажи допустимость эвристики или приведи контрпример."],
      ["Корректность пути", "Сложность", "Обоснование эвристики"]),
  },
  {
    id: "deep-learning", title: "Глубокое обучение и нейросети", expectedHours: 250,
    prerequisites: ["linear-algebra", "calculus-probability", "machine-learning"],
    sourceIds: ["mit-6s191"], seminar: true,
    outcomes: ["Понимать обратное распространение", "Реализовывать простые нейросети", "Оценивать устойчивость модели"],
    project: "Обучи небольшую нейросеть и представь отчёт об ошибках и воспроизводимости.",
    exam: exam("practical", 240, ["Реализуй простую сеть по заданным ограничениям.", "Объясни каждый этап градиентного обучения.", "Проанализируй неизвестный кейс отказа модели."],
      ["Понимание математики", "Рабочая реализация", "Честность выводов"]),
  },
  {
    id: "capstone", title: "Итоговый самостоятельный проект и защита", expectedHours: 220,
    prerequisites: ["software-engineering", "artificial-intelligence", "deep-learning"],
    sourceIds: [], seminar: true,
    outcomes: ["Самостоятельно спроектировать систему", "Показать работающий прототип", "Защитить технические решения"],
    project: "Спроектируй и реализуй полезный AI-продукт, затем защити решения перед независимыми экспертами.",
    exam: exam("coding", 360, ["За ограниченное время реализуй индивидуальный компонент системы без помощи ИИ.", "Пройди устную защиту нового изменения.", "Предоставь воспроизводимые тесты."],
      ["Собственное понимание и код", "Работоспособность", "Независимая проверка"]),
  },
];

export const AI_PROGRAM: DegreeProgram = {
  id: "ai-engineering",
  title: "Инженерия ИИ: фундаментальная траектория",
  disclaimer: "Независимая учебная программа на основе открытых материалов. Не является программой MIT, Stanford или Harvard, не даёт университетского диплома, аккредитации либо гарантии эквивалентности высшему образованию.",
  moduleIds: DEGREE_MODULES.map((course) => course.id),
};

export const MODULE_BY_ID = new Map(DEGREE_MODULES.map((item) => [item.id, item]));
export const SOURCE_BY_ID = new Map(COURSE_SOURCES.map((item) => [item.id, item]));
export const TOTAL_HOURS = DEGREE_MODULES.reduce((total, item) => total + item.expectedHours, 0);

export function estimateDuration(weeklyHours: number): { weeklyHours: number; totalHours: number; weeks: number; months: number } {
  if (!Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > 80)
    throw new RangeError("Укажите от 1 до 80 часов в неделю.");
  const weeks = Math.ceil(TOTAL_HOURS / weeklyHours);
  return { weeklyHours, totalHours: TOTAL_HOURS, weeks, months: Math.ceil(weeks * 12 / 52) };
}

export function nextAvailableModules(completed: readonly string[]): DegreeModule[] {
  const done = new Set(completed);
  return DEGREE_MODULES.filter((item) => !done.has(item.id) && item.prerequisites.every((id) => done.has(id)));
}

/**
 * Short session loop, proportional to learner time. Stages describe activities;
 * completion of a session is not a graded result.
 */
export function buildLessonLoop(module: DegreeModule, minutes: 15 | 30 | 60): LessonStage[] {
  const stages: { id: LessonStageId; title: string; weight: number; instruction: string; required: boolean }[] = [
    { id: "lecture", title: "Лекция / материал", weight: 28, required: true,
      instruction: "Изучи связанный материал по ссылке университета либо авторское объяснение. Можно ставить на паузу и задавать вопросы." },
    { id: "summary", title: "Краткий конспект", weight: 12, required: true,
      instruction: "Самостоятельно перескажи главную идею. Сравни с источником, не переписывая вслепую." },
    ...(module.seminar ? [{ id: "seminar" as const, title: "Семинар", weight: 20, required: true,
      instruction: "Реши задачу или создай маленький пример. Для рисунков и рукописной работы нужна отдельная визуальная проверка преподавателя." }] : []),
    { id: "explain", title: "Объясни своими словами", weight: 12, required: true,
      instruction: "Объясни принцип так, словно учишь другого человека. Оракул может уточнить ошибки, но сам не подтверждает знание." },
    { id: "practice", title: "Применение", weight: module.seminar ? 10 : 30, required: true,
      instruction: "Примени знание в новой задаче либо в контексте собственной цели." },
    { id: "check", title: "Проверка знаний", weight: 12, required: true,
      instruction: "Пройди независимую диагностику там, где она опубликована. Иначе результат остаётся неподтверждённым." },
    { id: "review", title: "Повторение", weight: 6, required: false,
      instruction: "Вернись к идее по расписанию повторений через 1, 3, 7, 14 и 30 дней." },
  ];
  const raw = stages.map((item) => ({ ...item, exact: minutes * item.weight / 100 }));
  const times = raw.map((item) => Math.floor(item.exact));
  let remainder = minutes - times.reduce((a, b) => a + b, 0);
  for (const { index } of raw.map((v, index) => ({ index, fraction: v.exact - Math.floor(v.exact) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)) {
    if (remainder-- <= 0) break;
    times[index]++;
  }
  return stages.map(({ id, title, instruction, required }, i) => ({ id, title, instruction, required, minutes: times[i] }));
}

export type AgentRole = "intake" | "curriculum" | "source-curator" | "tutor" | "assessor" | "examiner";
export const AGENT_HANDOFFS: readonly { from: AgentRole; to: AgentRole; payload: string }[] = [
  { from: "intake", to: "curriculum", payload: "goal, weeklyHours, experience, subject" },
  { from: "curriculum", to: "source-curator", payload: "programId, moduleIds, prerequisites" },
  { from: "source-curator", to: "tutor", payload: "verified external URLs, access restrictions, lesson objectives" },
  { from: "tutor", to: "assessor", payload: "topicId and independently created exercise, never a self-reported grade" },
  { from: "assessor", to: "examiner", payload: "verified assessment evidence, required proctoring status" },
];
