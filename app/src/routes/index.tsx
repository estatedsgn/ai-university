import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LearningCycle } from "../components/LearningCycle";
import { KnowledgeHub } from "../components/KnowledgeHub";
import { RoomExperience } from "../components/RoomExperience";
import { useRoom } from "../lib/use-room";

export const Route = createFileRoute("/")({ component: Index });
type Page = "campus" | "knowledge" | "programs" | "learning" | "history";
type ModalName = "create" | "join" | "enroll" | "profile" | "help" | null;
export type HistoryEntry = {
  id: string;
  topic: string;
  date: string;
  turns: number;
  allocatedSeconds: number;
};
const programs = [
  {
    id: "listening",
    name: "Искусство слушать",
    category: "КОММУНИКАЦИЯ",
    text: "Услышать собеседника, понять его мысль и задать хороший вопрос.",
    time: "20–30 минут",
    level: "Для каждого",
    color: "jade",
    icon: "ear",
  },
  {
    id: "speaking",
    name: "Говорить уверенно",
    category: "ЛИЧНЫЙ РОСТ",
    text: "Сформулировать мысль и донести её спокойно, ясно и своими словами.",
    time: "20–30 минут",
    level: "Для каждого",
    color: "peach",
    icon: "wave",
  },
  {
    id: "english",
    name: "English conversation",
    category: "ЯЗЫКИ",
    text: "Больше разговорной практики. Меньше страха перед первой фразой.",
    time: "25–35 минут",
    level: "От A2",
    color: "lavender",
    icon: "globe",
  },
  {
    id: "debate",
    name: "Диалог и аргументы",
    category: "МЫШЛЕНИЕ",
    text: "Обсуждать разные точки зрения и находить смысл, а не победителя.",
    time: "25–35 минут",
    level: "Для каждого",
    color: "sand",
    icon: "dialogue",
  },
];
const paths: Record<string, ReactNode> = {
  campus: (
    <>
      <path d="m3 10 9-6 9 6M5 10v10h14V10M9 20v-6h6v6" />
      <path d="M2 21h20" />
    </>
  ),
  book: (
    <>
      <path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" />
    </>
  ),
  growth: (
    <>
      <path d="M4 20h16M7 16V9m5 7V5m5 11v-5" />
      <path d="m3 7 5-4 6 3 7-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 11h18m-12 4h1m4 0h1" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  ear: (
    <>
      <path d="M8 15c0 7 7 7 7 2 0-3 6-5 4-10C16 1 7 3 6 9m4 2c0-5 7-5 6 0l-3 3" />
    </>
  ),
  wave: (
    <>
      <path d="M3 10v4m4-7v10m5-13v16m5-13v10m4-7v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  dialogue: (
    <>
      <path d="M14 14H7l-4 3V4h15v5M11 18h6l4 3V10h-8" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </>
  ),
  hand: (
    <>
      <path d="M8 12V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 9-9 11-13 5l-4-6a2 2 0 0 1 3-2l2 2Z" />
    </>
  ),
  link: (
    <>
      <path d="m10 14 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
    </>
  ),
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  leave: (
    <>
      <path d="M9 3H4v18h5m0-9h12m-4-4 4 4-4 4" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8Z" />,
  pause: <path d="M8 5v14m8-14v14" />,
  next: (
    <>
      <path d="m5 5 10 7-10 7Zm14 0v14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] || paths.book}
    </svg>
  );
}
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`}>
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path
          d="M8 26V10l10 6 10-6v16M8 10l10-5 10 5M18 16v15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button className="icon-button modal-close" aria-label="Закрыть" onClick={onClose}>
          <Icon name="close" />
        </button>
        <span className="eyebrow">AI УНИВЕРСИТЕТ</span>
        <h2 id="dialog-title">{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
    </dialog>
  );
}
function OrbitArt() {
  return (
    <div className="orbit-art" aria-hidden="true">
      <svg className="orbit-lines" viewBox="0 0 430 290">
        <ellipse cx="218" cy="148" rx="156" ry="103" transform="rotate(-12 218 148)" />
        <ellipse cx="218" cy="148" rx="125" ry="69" transform="rotate(26 218 148)" />
        <path d="M74 186c44 5 96-92 154-81s86 52 121 49" />
        <circle cx="349" cy="82" r="4" />
        <circle cx="72" cy="133" r="4" />
      </svg>
      <div className="orbit-center">
        <span className="sound-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>Давай поговорим</span>
      </div>
      <div className="orbit-person person-one">
        <svg viewBox="0 0 80 80">
          <rect width="80" height="80" rx="40" fill="#D8E9DF" />
          <path d="M14 81c1-31 52-31 54 0" fill="#176B5B" />
          <ellipse cx="40" cy="34" rx="15" ry="19" fill="#E9BC98" />
          <path d="M25 35c-6-24 30-33 32-5-11-4-12-11-12-11-2 8-11 13-20 16" fill="#384E42" />
          <path
            d="M34 36h1m12 0h1m-12 9q5 4 10 0"
            fill="none"
            stroke="#784C39"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="orbit-person person-two">
        <svg viewBox="0 0 80 80">
          <rect width="80" height="80" rx="40" fill="#F1DACE" />
          <path d="M13 80c2-29 52-29 54 0" fill="#C96C52" />
          <path d="M18 40c-5-37 47-43 45 0v20H18Z" fill="#6C463D" />
          <ellipse cx="40" cy="35" rx="15" ry="19" fill="#F4C9AA" />
          <path d="M24 29c6 0 14-6 18-14 3 7 9 14 16 15" fill="#6C463D" />
          <path
            d="M33 35h1m12 0h1m-12 9q5 4 10 0"
            fill="none"
            stroke="#A76C4B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="orbit-person person-three">
        <svg viewBox="0 0 80 80">
          <rect width="80" height="80" rx="40" fill="#E8E3F0" />
          <path d="M12 80c2-29 55-29 56 0" fill="#8D81A5" />
          <ellipse cx="40" cy="35" rx="15" ry="19" fill="#A97250" />
          <path d="M23 27c0-20 33-24 35 0-13-9-22-4-35 0" fill="#342D2D" />
          <path
            d="M33 36h1m12 0h1m-12 9q5 4 10 0"
            fill="none"
            stroke="#674126"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="orbit-note note-one">
        <Icon name="check" size={15} /> Тебя слушают
      </span>
      <span className="orbit-note note-two">
        <Icon name="mic" size={15} /> Твой ход
      </span>
    </div>
  );
}
function Index() {
  const [welcome, setWelcome] = useState(true);
  const [page, setPage] = useState<Page>("campus");
  const [modal, setModal] = useState<ModalName>(null);
  const [topic, setTopic] = useState("listening");
  const [name, setName] = useState("");
  const [roomLink, setRoomLink] = useState("");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const room = useRoom();
  useEffect(() => {
    try {
      if (localStorage.getItem("aiu-welcome-choice")) setWelcome(false);
      const savedName = localStorage.getItem("aiu-name");
      if (savedName) setName(savedName.slice(0, 60));
      const raw = JSON.parse(localStorage.getItem("aiu-history") || "[]");
      if (Array.isArray(raw))
        setHistory(
          raw
            .filter(
              (e) =>
                e &&
                typeof e.id === "string" &&
                typeof e.topic === "string" &&
                typeof e.date === "string" &&
                typeof e.turns === "number" &&
                typeof e.allocatedSeconds === "number",
            )
            .slice(0, 30),
        );
    } catch {
      /* Empty local profile is valid. */
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("material")) {
      setPage("knowledge");
      setWelcome(false);
    }
    const id = params.get("room");
    if (id) {
      setRoomLink(id);
      setModal("join");
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  function open(which: ModalName, selected = "listening") {
    setFormError("");
    setEnrolled(false);
    setTopic(selected);
    setModal(which);
  }
  function saveName(value: string) {
    setName(value);
    try {
      localStorage.setItem("aiu-name", value);
    } catch {
      /* Browsing continues without local storage. */
    }
  }
  function chooseWelcome(choice: string) {
    setWelcome(false);
    try {
      localStorage.setItem("aiu-welcome-choice", choice);
    } catch {}
    if (choice === "learning") go("learning");
    if (choice === "knowledge") go("knowledge");
    if (choice === "group") open("create");
    if (choice === "pilot") open("enroll");
  }
  function go(next: Page) {
    setPage(next);
    setQuery("");
  }
  async function createRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось создать комнату.");
      saveName(name.trim());
      setActiveRoom(result.roomId);
      room.connect(result.roomId, name.trim());
      setModal(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось создать комнату.");
    } finally {
      setBusy(false);
    }
  }
  function joinRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    let id = roomLink.trim();
    try {
      if (/^https?:\/\//.test(id)) id = new URL(id).searchParams.get("room") || "";
    } catch {
      id = "";
    }
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      setFormError("Вставь ссылку приглашения или полный код комнаты.");
      return;
    }
    saveName(name.trim());
    setActiveRoom(id);
    room.connect(id, name.trim());
    setModal(null);
  }
  function leaveRoom() {
    if (room.state) {
      const member = room.state.members.find((m) => m.id === room.selfId);
      if (member && member.turns > 0) {
        const entry: HistoryEntry = {
          id: `${activeRoom}-${Date.now()}`,
          topic: room.state.topic,
          date: new Date().toISOString(),
          turns: member.turns,
          allocatedSeconds: member.spokeSeconds,
        };
        const next = [entry, ...history].slice(0, 30);
        setHistory(next);
        try {
          localStorage.setItem("aiu-history", JSON.stringify(next));
        } catch {
          /* Local progress is optional. */
        }
      }
    }
    room.disconnect();
    setActiveRoom(null);
    setPage("history");
  }
  async function enroll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          goal: form.get("goal"),
          minutes: Number(form.get("minutes")),
          gamePercent: Number(form.get("gamePercent")),
          consent: form.get("consent") === "on",
          website: "",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить заявку.");
      saveName(String(form.get("name")));
      setEnrolled(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить заявку.");
    } finally {
      setBusy(false);
    }
  }
  const filtered = programs.filter((p) =>
    `${p.name} ${p.category} ${p.text}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (activeRoom)
    return (
      <RoomExperience
        room={room}
        roomId={activeRoom}
        participantName={name}
        onLeave={leaveRoom}
        onHelp={() => open("help")}
        help={modal === "help" ? <HelpModal onClose={() => setModal(null)} /> : null}
      />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("campus");
          }}
        >
          <Mark />
          <span>
            AI Университет<small>МЕСТО ДЛЯ РОСТА</small>
          </span>
        </a>
        <div className="sidebar-label">ТВОЙ УНИВЕРСИТЕТ</div>
        <nav className="university-nav" aria-label="Главная навигация">
          {(
            [
              { id: "campus", label: "Кампус", icon: "campus" },
              { id: "knowledge", label: "Карта знаний", icon: "book" },
              { id: "programs", label: "Программы", icon: "book" },
              { id: "learning", label: "Моё обучение", icon: "growth" },
              { id: "history", label: "Мои занятия", icon: "calendar" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => go(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
              {page === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-invite">
            <span className="mini-spark">✳</span>
            <strong>Начнём вместе?</strong>
            <p>
              Собираем первую группу.
              <br />
              Ты можешь стать её частью.
            </p>
            <button onClick={() => open("enroll")}>
              Хочу попробовать <Icon name="arrow" size={17} />
            </button>
          </div>
          <button className="help-link" onClick={() => open("help")}>
            <Icon name="help" size={18} /> Как всё устроено
          </button>
          <button className="profile" onClick={() => open("profile")}>
            <span className="avatar">{(name || "Т").charAt(0).toUpperCase()}</span>
            <span>
              <strong>{name || "Твой профиль"}</strong>
              <small>Личное пространство</small>
            </span>
            <span className="profile-dots">···</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Твой университет <span>/</span>{" "}
            <b>
              {page === "campus"
                ? "Кампус"
                : page === "knowledge"
                  ? "Карта знаний"
                  : page === "programs"
                  ? "Программы"
                  : page === "learning"
                    ? "Моё обучение"
                    : "Мои занятия"}
            </b>
          </span>
          <div className="topbar-actions">
            {page !== "knowledge" && <label className="search">
              <Icon name="search" size={17} />
              <input
                aria-label="Найти программу"
                placeholder="Найти программу"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value) setPage("programs");
                }}
              />
            </label>}
            <button
              className="top-avatar"
              aria-label="Настройки профиля"
              onClick={() => open("profile")}
            >
              {(name || "Т").charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">УЧИТЬСЯ. ОБЩАТЬСЯ. РАСТИ.</span>
              <h1>
                {page === "campus"
                  ? `Добро пожаловать${name ? `, ${name}` : " в кампус"}`
                  : page === "knowledge"
                    ? "Пойми, что ты уже знаешь"
                    : page === "programs"
                    ? "Найди свою практику"
                    : page === "learning"
                      ? "Знание становится навыком"
                      : "Твой путь, в твоём темпе"}
              </h1>
              <p>
                {page === "campus"
                  ? "Здесь каждый разговор — шаг к новой версии себя."
                  : page === "knowledge"
                    ? "Связанные темы, свои материалы и следующий понятный шаг."
                    : page === "programs"
                    ? "Выбери тему и пригласи людей в учебный разговор."
                    : page === "learning"
                      ? "Семь этапов, чтобы понять, попробовать и запомнить."
                      : "Маленькие шаги тоже меняют многое."}
              </p>
            </div>
            <span className="pilot-badge">
              <span /> Открытый пилот
            </span>
          </div>
          {page === "campus" && welcome && (
            <section className="welcome-choice">
              <div>
                <strong>Что тебе хочется сделать сегодня?</strong>
                <span>Выбирай то, к чему есть интерес.</span>
              </div>
              <div>
                <button onClick={() => chooseWelcome("knowledge")}>Разобраться в предмете</button>
                <button onClick={() => chooseWelcome("learning")}>Учиться самостоятельно</button>
                <button onClick={() => chooseWelcome("group")}>Общаться в группе</button>
                <button onClick={() => chooseWelcome("pilot")}>Стать тестировщиком</button>
                <button className="welcome-later" onClick={() => chooseWelcome("later")}>
                  Позже
                </button>
              </div>
            </section>
          )}
          {page === "campus" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    <span /> УЧИМСЯ В ЖИВОМ ДИАЛОГЕ
                  </span>
                  <h2>
                    Твой голос
                    <br />
                    имеет <span>значение.</span>
                  </h2>
                  <p>
                    Практикуйся в небольшой группе.
                    <br />
                    AI-модератор помогает говорить по очереди,
                    <br className="desktop-break" /> слышать друг друга и делать следующий шаг.
                  </p>
                  <div className="hero-actions">
                    <button className="button primary" onClick={() => open("create")}>
                      <Icon name="plus" size={19} /> Создать комнату
                    </button>
                    <button className="button text-button" onClick={() => open("join")}>
                      Войти по ссылке <Icon name="arrow" size={18} />
                    </button>
                  </div>
                  <div className="hero-footnote">
                    <span className="little-ring">
                      <Icon name="check" size={12} />
                    </span>{" "}
                    Без оценок за смелость. С уважением к твоему темпу.
                  </div>
                </div>
                <OrbitArt />
              </section>
              <div className="value-strip">
                <div>
                  <span className="value-icon">
                    <Icon name="dialogue" />
                  </span>
                  <span>
                    <strong>Живые разговоры</strong>
                    <small>Практика с другими людьми</small>
                  </span>
                </div>
                <div>
                  <span className="value-icon">
                    <Icon name="wave" />
                  </span>
                  <span>
                    <strong>Внимательный модератор</strong>
                    <small>Очередь, задания и время для каждого</small>
                  </span>
                </div>
                <div>
                  <span className="value-icon">
                    <Icon name="growth" />
                  </span>
                  <span>
                    <strong>Твой ритм обучения</strong>
                    <small>Возвращайся, когда будешь готов</small>
                  </span>
                </div>
              </div>
            </>
          )}
          {page === "campus" && (
            <section className="kh-campus-entry">
              <div>
                <span className="kh-eyebrow">ТВОЙ СЛЕДУЮЩИЙ ШАГ</span>
                <h2>Математика, финансы и биология — в одной карте.</h2>
                <p>Проверь основы, увидь связи между темами или создай тест по своему материалу.</p>
              </div>
              <button className="button secondary" onClick={() => go("knowledge")}>
                Открыть карту знаний <Icon name="arrow" size={18} />
              </button>
            </section>
          )}
          {page === "knowledge" && <KnowledgeHub />}
          {(page === "campus" || page === "programs") && (
            <section className="program-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">С ЧЕГО НАЧНЁМ?</span>
                  <h2>Разговоры, которые развивают</h2>
                </div>
                {page === "campus" && (
                  <button className="section-link" onClick={() => go("programs")}>
                    Все программы <Icon name="arrow" size={18} />
                  </button>
                )}
              </div>
              <div className="program-grid">
                {filtered.map((p) => (
                  <article className={`program-card ${p.color}`} key={p.id}>
                    <div className="program-top">
                      <span className="program-icon">
                        <Icon name={p.icon} size={27} />
                      </span>
                      <span className="level">{p.level}</span>
                    </div>
                    <span className="program-category">{p.category}</span>
                    <h3>{p.name}</h3>
                    <p>{p.text}</p>
                    <div className="program-bottom">
                      <span>
                        <Icon name="clock" size={15} />
                        {p.time}
                      </span>
                      <button
                        aria-label={`Создать занятие: ${p.name}`}
                        onClick={() => open("create", p.id)}
                      >
                        <Icon name="arrow" size={19} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <Icon name="search" size={30} />
                  <h3>Такой программы пока нет</h3>
                  <p>Попробуй «слушать», «английский» или «диалог».</p>
                  <button className="button secondary" onClick={() => setQuery("")}>
                    Сбросить поиск
                  </button>
                </div>
              )}
            </section>
          )}
          {(page === "campus" || page === "learning") && (
            <LearningCycle onPractice={() => open("create", "listening")} />
          )}
          {page === "history" && (
            <section className="history-section">
              {history.length ? (
                <>
                  <div className="section-heading">
                    <h2>Твои учебные разговоры</h2>
                    <span className="muted">Сохранены в этом браузере</span>
                  </div>
                  <div className="history-list">
                    {history.map((entry) => (
                      <article className="history-row" key={entry.id}>
                        <span className="history-icon">
                          <Icon name="dialogue" size={24} />
                        </span>
                        <div>
                          <h3>{programs.find((p) => p.id === entry.topic)?.name || entry.topic}</h3>
                          <p>
                            {new Date(entry.date).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}{" "}
                            · {entry.turns} ходов · {Math.round(entry.allocatedSeconds)} сек.
                            включённого микрофона
                          </p>
                        </div>
                        <button
                          className="button secondary compact"
                          onClick={() => open("create", entry.topic)}
                        >
                          Ещё раз <Icon name="refresh" size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                  <p className="history-note">
                    Это время включённого микрофона в твой ход. Оно не измеряет фактическую речь и
                    не оценивает навык.
                  </p>
                </>
              ) : (
                <div className="empty-state history-empty">
                  <span className="empty-illustration">
                    <Icon name="growth" size={44} />
                  </span>
                  <h2>Первый шаг ещё впереди</h2>
                  <p>
                    После первого разговора здесь появится твоя история.
                    <br />
                    Начни с темы, которая тебе интересна.
                  </p>
                  <button className="button primary" onClick={() => open("create")}>
                    <Icon name="plus" size={18} /> Начать занятие
                  </button>
                  <button className="section-link" onClick={() => open("join")}>
                    У меня есть приглашение <Icon name="arrow" size={17} />
                  </button>
                </div>
              )}
            </section>
          )}
          {page !== "history" && (
            <section className="pilot-section">
              <div className="pilot-symbol">✳</div>
              <div>
                <span className="eyebrow">СОЗДАЁМ УНИВЕРСИТЕТ ВМЕСТЕ</span>
                <h2>Твоя обратная связь — часть программы.</h2>
                <p>
                  Присоединяйся к первой тестовой группе. Расскажи, чему хочешь
                  <br className="desktop-break" /> научиться и какой формат тебе подходит.
                </p>
              </div>
              <button className="button secondary" onClick={() => open("enroll")}>
                Присоединиться <Icon name="arrow" size={18} />
              </button>
            </section>
          )}
          <footer className="footer">
            <span>
              AI Университет <span className="footer-dot">·</span> Учиться быть собой
            </span>
            <button onClick={() => open("help")}>
              О проекте <Icon name="arrow" size={14} />
            </button>
          </footer>
        </main>
      </div>
      {modal === "create" && (
        <Modal
          title="Начнём разговор"
          subtitle="Создай комнату и пригласи участников. Ссылка появится после создания."
          onClose={() => setModal(null)}
        >
          <form onSubmit={createRoom}>
            <label className="field">
              Как тебя называть?
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
                maxLength={60}
                placeholder="Твоё имя"
                autoComplete="given-name"
              />
            </label>
            <label className="field">
              Тема занятия
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                {programs.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-note">
              <Icon name="help" size={18} />
              <p>
                Камера и микрофон включаются отдельно, по твоему нажатию. Ты будешь ведущим этой
                комнаты.
              </p>
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "Создаём комнату…" : "Создать комнату"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "join" && (
        <Modal
          title="Тебя ждёт разговор"
          subtitle="Вставь ссылку, которую прислал ведущий занятия."
          onClose={() => setModal(null)}
        >
          <form onSubmit={joinRoom}>
            <label className="field">
              Как тебя называть?
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
                maxLength={60}
                placeholder="Твоё имя"
                autoComplete="given-name"
              />
            </label>
            <label className="field">
              Ссылка или код комнаты
              <input
                value={roomLink}
                onChange={(e) => setRoomLink(e.target.value)}
                required
                placeholder="https://…/?room=…"
                autoCapitalize="off"
                spellCheck={false}
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full">
              Войти в комнату <Icon name="arrow" size={18} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "enroll" && (
        <Modal
          title={enrolled ? "Ты в списке первой группы" : "Каким будет твоё обучение?"}
          subtitle={
            enrolled
              ? "Заявка сохранена для организатора. Письмо автоматически не отправляется."
              : "Нам важно, чего хочешь именно ты. Помоги подобрать формат первой тестовой группы."
          }
          onClose={() => setModal(null)}
        >
          {enrolled ? (
            <div className="success-state">
              <span>
                <Icon name="check" size={32} />
              </span>
              <p>А пока можно пригласить знакомых и провести первый учебный разговор.</p>
              <button className="button primary full" onClick={() => open("create")}>
                Попробовать сейчас <Icon name="arrow" size={18} />
              </button>
            </div>
          ) : (
            <EnrollmentForm name={name} busy={busy} error={formError} onSubmit={enroll} />
          )}
        </Modal>
      )}
      {modal === "profile" && (
        <Modal
          title="Твоё пространство"
          subtitle="Имя и история занятий хранятся в этом браузере."
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName(name.trim());
              setModal(null);
              setNotice("Имя сохранено");
            }}
          >
            <label className="field">
              Как тебя называть?
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
                placeholder="Твоё имя"
                autoComplete="given-name"
              />
            </label>
            <button className="button primary full">
              Сохранить <Icon name="check" size={18} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {notice}
          <button
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function EnrollmentForm({
  name,
  busy,
  error,
  onSubmit,
}: {
  name: string;
  busy: boolean;
  error: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const [gamePercent, setGamePercent] = useState(30);
  return (
    <form onSubmit={onSubmit}>
      <div className="form-row">
        <label className="field">
          Имя
          <input
            name="name"
            defaultValue={name}
            required
            maxLength={60}
            placeholder="Твоё имя"
            autoComplete="given-name"
          />
        </label>
        <label className="field">
          Почта для связи
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
      </div>
      <label className="field">
        Чему ты хочешь научиться?
        <textarea
          name="goal"
          required
          minLength={3}
          maxLength={1000}
          rows={3}
          placeholder="Например, увереннее говорить в группе и лучше слушать других"
        />
      </label>
      <fieldset className="time-choices">
        <legend>Сколько времени тебе комфортно?</legend>
        {[15, 30, 60].map((minutes) => (
          <label key={minutes}>
            <input name="minutes" type="radio" value={minutes} defaultChecked={minutes === 30} />
            <span>{minutes} минут</span>
          </label>
        ))}
      </fieldset>
      <label className="field format-range">
        Твой баланс форматов
        <div className="range-labels">
          <span>
            Игровой <b>{gamePercent}%</b>
          </span>
          <span>
            Обычная практика <b>{100 - gamePercent}%</b>
          </span>
        </div>
        <input
          name="gamePercent"
          type="range"
          min="0"
          max="100"
          step="5"
          value={gamePercent}
          onChange={(e) => setGamePercent(Number(e.target.value))}
        />
        <small>Игры, роли и задания или спокойное обсуждение — сочетание выбираешь ты.</small>
      </label>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>
          Согласен на сохранение имени, почты и пожеланий для организации тестовой группы.
          Организатор сможет связаться со мной.
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" disabled={busy}>
        {busy ? "Сохраняем заявку…" : "Хочу в первую группу"}
        <Icon name="arrow" size={18} />
      </button>
      <p className="privacy-note">Заявка добровольная. Занятия доступны и без неё.</p>
    </form>
  );
}
function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Учимся в разговоре"
      subtitle="AI Университет — открытый пилот для совместной практики общения."
      onClose={onClose}
    >
      <div className="help-content">
        <h3>Как проходит занятие</h3>
        <p>
          Ведущий создаёт комнату и делится ссылкой. Участники поднимают руку. Модератор даёт слово
          по очереди, показывает задание и следит за временем. Ведущий может передать слово и
          выключить микрофон участника.
        </p>
        <h3>Что умеет модератор сейчас</h3>
        <p>
          В пилоте он работает по заранее подготовленным сценариям. Языковая модель пока не
          подключена: ответы не анализируются и качество речи не оценивается. Озвучку задания можно
          включить отдельно.
        </p>
        <h3>Камера, звук и приватность</h3>
        <p>
          Доступ к камере и микрофону запрашивается только по нажатию. Медиа передаётся напрямую
          между браузерами через WebRTC. В некоторых сетях соединение может не установиться:
          TURN-сервер пока не подключён.
        </p>
        <p>
          Выключение микрофона выполняется приложением участника. Сервер управляет очередью, но не
          принудительно блокирует аудио на медиасервере. Запись звонков не ведётся.
        </p>
        <h3>Прогресс и участие</h3>
        <p>
          Локальная история и упражнения хранятся в этом браузере. Можно повторять практику и тесты
          столько, сколько нужно. Заявки в первую группу сохраняются для организатора;
          автоматическая рассылка пока не подключена.
        </p>
        <button className="button primary full" onClick={onClose}>
          Понятно <Icon name="check" size={18} />
        </button>
      </div>
    </Modal>
  );
}
