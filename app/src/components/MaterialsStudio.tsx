import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { AgentQuiz, MaterialImportInput, MaterialPublic } from "../lib/learning-types";
import "../materials-studio.css";

type ImportMode = "text" | "url" | "agent";
type RecentMaterial = Pick<MaterialPublic, "id" | "title" | "visibility">;
const RECENT_KEY = "ai-university:materials:v1";
const MATERIAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_HOSTS = ["wikipedia.org", "openstax.org", "math.libretexts.org", "ocw.mit.edu", "khanacademy.org"];

const AGENT_EXAMPLE: AgentQuiz = {
  title: "Дроби: первая проверка",
  summary: "Пять вопросов о равных долях, сравнении и сложении дробей. Пример структуры для вашего агента.",
  questions: [
    { prompt: "Пирог разделили на 4 равные части. Какую долю составляет одна часть?", options: ["1/4", "4/1", "1/3", "3/4"], correctIndex: 0, explanation: "Знаменатель показывает число равных частей: одна из четырёх — 1/4." },
    { prompt: "Какая дробь равна 1/2?", options: ["1/4", "2/4", "2/3", "3/4"], correctIndex: 1, explanation: "Умножение числителя и знаменателя на 2 даёт 2/4 и сохраняет долю." },
    { prompt: "Сколько будет 1/5 + 2/5?", options: ["3/10", "2/5", "3/5", "1/5"], correctIndex: 2, explanation: "При одинаковом знаменателе складываем числители: 1 + 2 = 3, знаменатель остаётся 5." },
    { prompt: "Какая доля больше: 3/4 или 1/4?", options: ["Они равны", "1/4", "Нельзя сравнить", "3/4"], correctIndex: 3, explanation: "Размер долей одинаковый; три четверти больше одной четверти." },
    { prompt: "Как записать одну целую с знаменателем 7?", options: ["7/7", "1/7", "7/1", "0/7"], correctIndex: 0, explanation: "Семь из семи равных частей составляют целое." },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sourceUrlValid(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      SOURCE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith("." + host));
  } catch {
    return false;
  }
}

function readAgentQuiz(raw: string): AgentQuiz {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Не удалось прочитать JSON. Проверьте кавычки и запятые или откройте пример."); }
  if (!isRecord(parsed) || typeof parsed.title !== "string" || parsed.title.trim().length < 2 ||
      parsed.title.length > 160 || typeof parsed.summary !== "string" ||
      parsed.summary.trim().length < 10 || parsed.summary.length > 1200 ||
      !Array.isArray(parsed.questions) || parsed.questions.length < 5 || parsed.questions.length > 10) {
    throw new Error("Нужны title (2–160 символов), summary (10–1200 символов) и от 5 до 10 questions.");
  }
  const questions = parsed.questions.map((question: unknown, index: number) => {
    if (!isRecord(question) || typeof question.prompt !== "string" ||
        question.prompt.trim().length < 10 || question.prompt.length > 800 ||
        !Array.isArray(question.options) || question.options.length !== 4 ||
        !question.options.every((option: unknown) => typeof option === "string" &&
          option.trim().length > 0 && option.length <= 250) ||
        typeof question.correctIndex !== "number" || !Number.isInteger(question.correctIndex) ||
        question.correctIndex < 0 || question.correctIndex > 3 ||
        typeof question.explanation !== "string" || question.explanation.trim().length < 5 ||
        question.explanation.length > 1200) {
      throw new Error("Вопрос " + (index + 1) + ": нужны prompt, четыре options, correctIndex от 0 до 3 и explanation.");
    }
    const options = (question.options as string[]).map((option) => option.trim());
    if (new Set(options).size !== 4) throw new Error("Вопрос " + (index + 1) + ": варианты ответа должны различаться.");
    return { prompt: question.prompt.trim(), options, correctIndex: question.correctIndex, explanation: question.explanation.trim() };
  });
  if (new Set(questions.map((question) => question.prompt)).size !== questions.length) throw new Error("Вопросы не должны повторяться.");
  return { title: parsed.title.trim(), summary: parsed.summary.trim(), questions };
}

function parseMaterial(value: unknown): MaterialPublic | null {
  if (!isRecord(value) || typeof value.id !== "string" || !MATERIAL_ID.test(value.id) ||
      typeof value.title !== "string" || !value.title.trim() || value.title.length > 160 ||
      typeof value.summary !== "string" || value.summary.length > 1200 ||
      (typeof value.track !== "string" || !["math", "finance", "biology", "custom"].includes(value.track)) ||
      typeof value.questionCount !== "number" || !Number.isInteger(value.questionCount) ||
      value.questionCount < 5 || value.questionCount > 10 ||
      typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) ||
      (typeof value.origin !== "string" || !["ai", "agent"].includes(value.origin)) || value.reviewed !== false ||
      (typeof value.visibility !== "string" || !["private", "unlisted"].includes(value.visibility)) ||
      (value.sourceUrl !== null && (typeof value.sourceUrl !== "string" || !sourceUrlValid(value.sourceUrl)))) return null;
  return value as MaterialPublic;
}

function readRecent(): RecentMaterial[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20).flatMap((item: unknown): RecentMaterial[] =>
      isRecord(item) && typeof item.id === "string" && MATERIAL_ID.test(item.id) &&
      typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 160 &&
      (item.visibility === "private" || item.visibility === "unlisted")
        ? [{ id: item.id, title: item.title, visibility: item.visibility }] : []);
  } catch { return []; }
}

function rememberMaterial(material: MaterialPublic): boolean {
  try {
    const recent = [{ id: material.id, title: material.title, visibility: material.visibility },
      ...readRecent().filter((item) => item.id !== material.id)].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    return true;
  } catch { return false; }
}

function responseMessage(value: unknown, status: number): string {
  if (isRecord(value)) {
    const error = value.error;
    if (typeof error === "string" && error.length <= 500) return error;
    if (isRecord(error) && typeof error.message === "string" && error.message.length <= 500) return error.message;
    if (typeof value.message === "string" && value.message.length <= 500) return value.message;
  }
  if (status === 404) return "Материал не найден или доступен только в браузере автора.";
  if (status === 401 || status === 403) return "Для генерации нужен действующий токен организатора.";
  if (status === 429) return "Лимит импорта исчерпан. Попробуйте позже.";
  if (status === 503) return "Генерация ИИ пока не настроена на сервере. Можно импортировать готовый тест от агента.";
  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

async function materialRequest(url: string, options: RequestInit): Promise<MaterialPublic> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(responseMessage(payload, response.status));
  const material = isRecord(payload) ? parseMaterial(payload.material) : null;
  if (!material) throw new Error("Сервер вернул неполный материал. Попробуйте позже.");
  return material;
}

export function MaterialsStudio({ onStartQuiz }: { onStartQuiz: (material: MaterialPublic) => void }) {
  const id = useId();
  const [mode, setMode] = useState<ImportMode>("agent");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [agentJson, setAgentJson] = useState("");
  const [token, setToken] = useState("");
  const [track, setTrack] = useState<MaterialPublic["track"]>("math");
  const [shareable, setShareable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [material, setMaterial] = useState<MaterialPublic | null>(null);
  const [recent, setRecent] = useState<RecentMaterial[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const controller = useRef<AbortController | null>(null);

  const showMaterial = useCallback((value: MaterialPublic) => {
    setMaterial(value);
    setStorageAvailable(rememberMaterial(value));
    setRecent(readRecent());
    setCopyStatus("");
    const link = new URL(window.location.pathname, window.location.origin);
    link.searchParams.set("material", value.id);
    setShareUrl(value.visibility === "unlisted" ? link.href : "");
  }, []);

  useEffect(() => {
    setRecent(readRecent());
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const materialId = search.get("material") || hash.get("material");
    if (!materialId) return () => controller.current?.abort();
    if (!MATERIAL_ID.test(materialId)) {
      setError("В ссылке неверный идентификатор материала.");
      return () => controller.current?.abort();
    }
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    materialRequest("/api/materials/" + encodeURIComponent(materialId), { signal: request.signal })
      .then((value) => { if (!request.signal.aborted) showMaterial(value); })
      .catch((cause: unknown) => { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось открыть материал."); })
      .finally(() => { if (!request.signal.aborted) setBusy(false); });
    return () => request.abort();
  }, [showMaterial]);

  const openRecent = async (materialId: string) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError("");
    try {
      const value = await materialRequest("/api/materials/" + encodeURIComponent(materialId), { signal: request.signal });
      if (!request.signal.aborted) showMaterial(value);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось открыть материал.");
    } finally { if (!request.signal.aborted) setBusy(false); }
  };

  const importMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(""); setCopyStatus("");
    let input: MaterialImportInput;
    try {
      const common = { track, visibility: shareable ? "unlisted" as const : "private" as const };
      if (mode === "agent") {
        if (agentJson.length > 50_000) throw new Error("JSON слишком большой. Оставьте 5–10 вопросов и короткие объяснения.");
        input = { ...common, agentQuiz: readAgentQuiz(agentJson) };
      } else {
        if (!token.trim()) throw new Error("Введите токен организатора. Готовый JSON от агента можно импортировать без токена.");
        if (token.length < 16 || token.length > 512) throw new Error("Проверьте токен организатора.");
        if ((title.trim().length > 0 && title.trim().length < 2) || title.trim().length > 160) throw new Error("Название должно содержать 2–160 символов или остаться пустым.");
        if (mode === "text") {
          if (text.trim().length < 100 || text.length > 12_000) throw new Error("Вставьте от 100 до 12 000 символов учебного текста.");
          input = { ...common, title: title.trim() || undefined, text: text.trim() };
        } else {
          if (!sourceUrlValid(url.trim())) throw new Error("Нужна HTTPS-ссылка на Wikipedia, OpenStax, math.libretexts.org, ocw.mit.edu или Khan Academy. Другой материал вставьте текстом.");
          input = { ...common, title: title.trim() || undefined, url: url.trim() };
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Проверьте материал.");
      return;
    }
    const body = JSON.stringify(input);
    if (new TextEncoder().encode(body).byteLength > 64_000) { setError("Сократите материал: общий размер запроса должен быть меньше 64 КБ."); return; }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (mode !== "agent") headers["X-Import-Token"] = token.trim();
      const value = await materialRequest("/api/materials/import", {
        method: "POST", headers, body, signal: request.signal,
      });
      if (!request.signal.aborted) showMaterial(value);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось импортировать материал.");
    } finally { if (!request.signal.aborted) setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopyStatus("Ссылка скопирована."); }
    catch { setCopyStatus("Выделите и скопируйте ссылку ниже."); }
  };

  return (
    <section className="ms-studio" aria-labelledby={id + "-heading"}>
      <header className="ms-heading">
        <span className="ms-eyebrow">Мастерская материалов</span>
        <h2 id={id + "-heading"}>Из материала — в понятную проверку</h2>
        <p>Вставьте текст, образовательную ссылку или тест от своего агента. Затем ответьте по одному вопросу и разберите пробелы.</p>
      </header>
      <ol className="ms-flow" aria-label="Как это работает">
        <li><span>1</span> Материал</li><li><span>2</span> 5–10 вопросов</li><li><span>3</span> Проверка и разбор</li>
      </ol>
      <div className="ms-grid">
        <form className="ms-card" onSubmit={importMaterial}>
          <fieldset className="ms-mode" disabled={busy}>
            <legend>Что добавляем?</legend>
            {([["text", "Текст"], ["url", "Ссылка"], ["agent", "Тест от агента"]] as const).map(([value, label]) => (
              <label key={value} className={mode === value ? "ms-mode-active" : ""}>
                <input type="radio" name={id + "-mode"} value={value} checked={mode === value} onChange={() => { setMode(value); setError(""); }} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {mode !== "agent" && (
            <label className="ms-label" htmlFor={id + "-title"}>
              Название <span className="ms-optional">необязательно</span>
              <input id={id + "-title"} className="ms-input" value={title} minLength={2} maxLength={160} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="Например, вероятности для начинающих" />
            </label>
          )}
          {mode === "text" && (
            <label className="ms-label" htmlFor={id + "-text"}>
              Учебный текст
              <textarea id={id + "-text"} className="ms-input" rows={9} minLength={100} maxLength={12_000} required disabled={busy} value={text} onChange={(event) => setText(event.target.value)} placeholder="Вставьте объяснение темы: определения, примеры и ключевые идеи..." aria-describedby={id + "-source-help"} />
              <span id={id + "-source-help"} className="ms-help">{text.length.toLocaleString("ru-RU")} / 12 000 символов · минимум 100</span>
            </label>
          )}
          {mode === "url" && (
            <label className="ms-label" htmlFor={id + "-url"}>
              Ссылка на учебную страницу
              <input id={id + "-url"} type="url" className="ms-input" value={url} maxLength={2048} required disabled={busy} onChange={(event) => setUrl(event.target.value)} placeholder="https://ru.wikipedia.org/wiki/..." aria-describedby={id + "-url-help"} />
              <span id={id + "-url-help"} className="ms-help">Wikipedia, OpenStax, math.libretexts.org, ocw.mit.edu и Khan Academy. Закрытые страницы, другие сайты и PDF добавьте текстом. Некоторые страницы этих источников тоже могут быть недоступны для чтения.</span>
            </label>
          )}
          {mode === "agent" && (
            <div>
              <div className="ms-agent-intro">
                <p>Агент может подготовить готовый тест. Скопируйте его JSON сюда — токен организатора для этого режима не нужен.</p>
                <button type="button" className="ms-link-button" disabled={busy} onClick={() => setAgentJson(JSON.stringify(AGENT_EXAMPLE, null, 2))}>Вставить учебный пример</button>
              </div>
              <label className="ms-label" htmlFor={id + "-json"}>
                JSON теста
                <textarea id={id + "-json"} className="ms-input ms-code" rows={12} maxLength={50_000} required disabled={busy} value={agentJson} onChange={(event) => setAgentJson(event.target.value)} spellCheck={false} placeholder='{"title":"Тема","summary":"Краткое описание","questions":[...]}' aria-describedby={id + "-json-help"} />
                <span id={id + "-json-help"} className="ms-help">5–10 вопросов. В каждом: prompt, options из 4 разных вариантов, correctIndex от 0 до 3 и explanation. Пример — самостоятельный готовый тест, а не генерация по вашему материалу.</span>
              </label>
            </div>
          )}
          <label className="ms-label" htmlFor={id + "-track"}>
            К какому треку относится?
            <select id={id + "-track"} className="ms-input" value={track} disabled={busy} onChange={(event) => setTrack(event.target.value as MaterialPublic["track"])}>
              <option value="math">Математика</option><option value="finance">Финансы</option><option value="biology">Биология</option><option value="custom">Другая тема</option>
            </select>
          </label>
          {mode !== "agent" && (
            <div className="ms-token">
              <label className="ms-label" htmlFor={id + "-token"}>
                Токен организатора
                <input id={id + "-token"} type="password" className="ms-input" value={token} maxLength={512} disabled={busy} onChange={(event) => setToken(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Токен доступа к генерации" aria-describedby={id + "-token-help"} />
              </label>
              <p id={id + "-token-help"} className="ms-help">Генерация требует настройки ИИ на сервере и доступа организатора. Это токен сервиса, а не ключ OpenAI. Он хранится только в памяти этой страницы.</p>
              {token && <button className="ms-link-button" type="button" disabled={busy} onClick={() => setToken("")}>Очистить токен</button>}
            </div>
          )}
          <label className="ms-checkbox">
            <input type="checkbox" checked={shareable} disabled={busy} onChange={(event) => setShareable(event.target.checked)} />
            <span>Разрешить доступ по секретной ссылке <small>Любой получивший ссылку сможет открыть материал и пройти тест. По умолчанию — только этот браузер.</small></span>
          </label>
          <p className="ms-help">Добавляйте учебные материалы, которыми вправе пользоваться. Для генерации текст передаётся внешнему поставщику ИИ; не вставляйте личные данные или секреты.</p>
          {error && <p className="ms-error" role="alert">{error}</p>}
          <button type="submit" className="ms-button" disabled={busy}>{busy ? "Обрабатываем материал…" : mode === "agent" ? "Импортировать тест" : "Создать вопросы с ИИ"}</button>
          <p className="ms-help" role="status">{busy ? "Дождитесь ответа сервера. Обычно это занимает некоторое время." : "Тест появится только после успешной обработки. До 10 импортов в сутки с одного сетевого адреса."}</p>
        </form>
        <aside className="ms-aside" aria-label="Материалы и следующие шаги">
          {material ? (
            <article className="ms-card ms-result">
              <span className="ms-badge">Учебный черновик · не проверен преподавателем</span>
              <h3>{material.title}</h3>
              <p className="ms-summary">{material.summary}</p>
              <dl className="ms-facts">
                <div><dt>Вопросов</dt><dd>{material.questionCount}</dd></div>
                <div><dt>Источник теста</dt><dd>{material.origin === "ai" ? "Генерация ИИ" : "Ваш агент"}</dd></div>
                <div><dt>Доступ</dt><dd>{material.visibility === "unlisted" ? "По секретной ссылке" : "Этот браузер"}</dd></div>
              </dl>
              {material.sourceUrl && <a className="ms-source-link" href={material.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>}
              <button type="button" className="ms-button" disabled={busy} onClick={() => onStartQuiz(material)}>Проверить понимание →</button>
              <p className="ms-help">Ответы помогают найти темы для повторения. Такой тест может содержать ошибки и не подтверждает официальную квалификацию или освоение ступени программы.</p>
              {shareUrl && (
                <div className="ms-sharing">
                  <label className="ms-label" htmlFor={id + "-share"}>Ссылка для ученика или агента
                    <input id={id + "-share"} className="ms-input" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                  </label>
                  <button type="button" className="ms-link-button" onClick={copyLink}>Скопировать ссылку</button>
                  <p className="ms-help" role="status">{copyStatus || "Храните ссылку как доступ к материалу."}</p>
                </div>
              )}
              {!shareUrl && <p className="ms-help">Приватный материал открывается с cookie автора. Очистка cookies или смена браузера может закрыть к нему доступ.</p>}
            </article>
          ) : (
            <div className="ms-card ms-empty">
              <div className="ms-empty-icon" aria-hidden="true">✳</div>
              <h3>Здесь появится ваша тема</h3>
              <p>Сначала материал, затем короткая проверка. После каждого ответа — объяснение, чтобы понять, что уже получается и что повторить.</p>
              <p className="ms-help">Результат — ориентир для обучения. Для подтверждения навыка нужны новые задачи, объяснение решения и проверка преподавателя.</p>
            </div>
          )}
          <div className="ms-card">
            <div className="ms-recent-heading"><h3>Мои материалы</h3>{recent.length > 0 && <button className="ms-link-button" type="button" disabled={busy} onClick={() => { try { localStorage.removeItem(RECENT_KEY); setRecent([]); } catch { setStorageAvailable(false); } }}>Очистить список</button>}</div>
            {recent.length === 0 ? <p className="ms-help">После импорта здесь появятся названия последних материалов.</p> :
              <ul className="ms-recent">{recent.map((item) => <li key={item.id}><button type="button" disabled={busy} onClick={() => openRecent(item.id)}><span>{item.title}</span><small>{item.visibility === "private" ? "Приватный" : "По ссылке"} →</small></button></li>)}</ul>}
            <p className="ms-help">{storageAvailable ? "Список хранится только в этом браузере: название и идентификатор. Тексты, вопросы и токен сюда не записываются. Очистка списка не удаляет материал на сервере." : "Браузер не разрешил сохранить список. Открытый материал доступен сейчас; для общего материала сохраните ссылку."}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
