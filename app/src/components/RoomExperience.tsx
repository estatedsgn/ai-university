import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { useRoom } from "../lib/use-room";
import { LESSONS, type RoomMember } from "../lib/room-types";
import { Icon, Modal } from "../routes/index";
type RoomHook = ReturnType<typeof useRoom>;
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
function VideoTile({
  member,
  stream,
  self,
  speaking,
  peerStatus,
}: {
  member: RoomMember;
  stream?: MediaStream | null;
  self: boolean;
  speaking: boolean;
  peerStatus?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream || null;
    if (stream) {
      const promise = video.play();
      promise?.catch(() => setBlocked(true));
    } else setBlocked(false);
  }, [stream]);
  async function play() {
    try {
      await ref.current?.play();
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  }
  return (
    <article className={`video-tile ${speaking ? "speaking" : ""}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={self}
        className={member.camera && stream ? "tile-video" : "tile-video camera-hidden"}
      />
      {(!member.camera || !stream) && <div className="tile-avatar">{initials(member.name)}</div>}
      {speaking && (
        <span className="speaker-pill">
          <Icon name="wave" size={13} /> Говорит
        </span>
      )}
      {member.hand && !speaking && (
        <span className="hand-pill">
          <Icon name="hand" size={15} />
        </span>
      )}
      <div className="tile-bottom">
        <span>
          {member.name}
          {self && " (ты)"}
          {member.isHost && <small>Ведущий</small>}
        </span>
        <span className={`mic-indicator ${member.mic ? "on" : ""}`}>
          <Icon name="mic" size={15} />
          {!member.mic && <i />}
        </span>
      </div>
      {!self && !stream && (
        <span className="peer-status">
          {peerStatus === "failed"
            ? "Медиа не подключено"
            : peerStatus === "connecting"
              ? "Соединяем медиа…"
              : "Камера выключена"}
        </span>
      )}
      {blocked && !self && stream && (
        <button className="audio-unlock" onClick={play}>
          <Icon name="volume" size={16} /> Включить звук
        </button>
      )}
    </article>
  );
}
export function RoomExperience({
  room,
  roomId,
  participantName,
  onLeave,
  onHelp,
  help,
}: {
  room: RoomHook;
  roomId: string;
  participantName: string;
  onLeave: () => void;
  onHelp: () => void;
  help: ReactNode;
}) {
  const {
    state,
    selfId,
    isHost,
    status,
    error,
    localStream,
    remoteStreams,
    peerStatus,
    mediaError,
    micOn,
    cameraOn,
  } = room;
  const [tab, setTab] = useState<"queue" | "chat">("queue");
  const [text, setText] = useState("");
  const [copyText, setCopyText] = useState("");
  const [now, setNow] = useState(0);
  const [offset, setOffset] = useState(0);
  const [tts, setTts] = useState(false);
  const [speakingPrompt, setSpeakingPrompt] = useState(false);
  const [endModal, setEndModal] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTts("speechSynthesis" in window);
    const id = setInterval(() => setNow(Date.now()), 250);
    setNow(Date.now());
    return () => {
      clearInterval(id);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    if (state) setOffset(state.serverNow - Date.now());
  }, [state?.serverNow]);
  useEffect(() => {
    if (tab === "chat") chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [state?.messages.length, tab]);
  useEffect(() => {
    if (!copyText) return;
    const id = setTimeout(() => setCopyText(""), 3500);
    return () => clearTimeout(id);
  }, [copyText]);
  async function copyInvite() {
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("room", roomId);
      url.hash = "";
      await navigator.clipboard.writeText(url.toString());
      setCopyText("Ссылка скопирована");
    } catch {
      setCopyText("Код комнаты: " + roomId);
    }
  }
  function readPrompt() {
    if (!state || !tts) return;
    if (speakingPrompt) {
      window.speechSynthesis.cancel();
      setSpeakingPrompt(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(state.prompt);
    utterance.lang = state.topic === "english" ? "en-US" : "ru-RU";
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingPrompt(false);
    utterance.onerror = () => setSpeakingPrompt(false);
    window.speechSynthesis.speak(utterance);
    setSpeakingPrompt(true);
  }
  function sendChat(e: FormEvent) {
    e.preventDefault();
    if (text.trim() && room.send({ type: "chat", text: text.trim() })) setText("");
  }
  const own = state?.members.find((m) => m.id === selfId);
  const speaker = state?.members.find((m) => m.id === state.speakerId);
  const myTurn = state?.phase === "running" && state.speakerId === selfId;
  const remaining = state?.turnEndsAt
    ? Math.max(0, Math.ceil((state.turnEndsAt - now - offset) / 1000))
    : 0;
  const title = state ? LESSONS[state.topic].title : "Учебная комната";
  if (!state)
    return (
      <div className="room-loading">
        <span className="room-loading-mark">
          <Icon name="dialogue" size={40} />
        </span>
        <span className="eyebrow">AI УНИВЕРСИТЕТ</span>
        <h1>
          {status === "error" || status === "disconnected"
            ? "Не удалось подключиться"
            : "Встречаемся в комнате"}
        </h1>
        <p>
          {error ||
            (status === "disconnected"
              ? "Соединение прервалось. Попробуй подключиться ещё раз."
              : "Устанавливаем соединение с учебной комнатой…")}
        </p>
        <div>
          <button className="button secondary" onClick={onLeave}>
            Вернуться в кампус
          </button>
          {(status === "error" || status === "disconnected") && (
            <button
              className="button primary"
              onClick={() => room.connect(roomId, participantName)}
            >
              Попробовать ещё раз
            </button>
          )}
        </div>
        {help}
      </div>
    );
  return (
    <div className="room-shell">
      <header className="room-header">
        <div className="room-brand">
          <span className="room-brand-mark">
            <Icon name="campus" size={25} />
          </span>
          <div>
            <span className="eyebrow">AI УНИВЕРСИТЕТ · УЧЕБНАЯ КОМНАТА</span>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="room-header-actions">
          <span className={`connection-pill ${status !== "connected" ? "offline" : ""}`}>
            <i />
            {status === "connected" ? "На связи" : "Нет соединения"}
          </span>
          <button className="button secondary compact" onClick={copyInvite}>
            <Icon name="link" size={16} /> Пригласить
          </button>
          <button className="icon-button" aria-label="Как устроена комната" onClick={onHelp}>
            <Icon name="help" />
          </button>
          <button className="room-leave" onClick={onLeave}>
            <Icon name="leave" size={17} /> Выйти
          </button>
        </div>
      </header>
      <div className="room-main">
        <section className="call-area">
          <div className="call-status">
            <div>
              <span className={`phase-dot ${state.phase}`} />
              <span>
                {state.phase === "ready"
                  ? "Собираемся перед разговором"
                  : state.phase === "paused"
                    ? "Пауза — можно перевести дух"
                    : state.phase === "ended"
                      ? "Занятие завершено"
                      : speaker
                        ? `${speaker.name} сейчас говорит`
                        : "Ожидаем поднятые руки"}
              </span>
            </div>
            <span>{state.members.length} участников</span>
          </div>
          {(error || status !== "connected") && (
            <div className="room-alert" role="alert">
              <p>{error || "Связь прервалась. Для продолжения нужно подключиться снова."}</p>
              {status !== "connected" && (
                <button
                  className="button secondary compact"
                  onClick={() => room.connect(roomId, participantName)}
                >
                  Подключиться
                </button>
              )}
            </div>
          )}
          {state.phase === "running" && speaker && (
            <div className={`turn-banner ${myTurn ? "your-turn" : ""}`}>
              <span>
                <Icon name={myTurn ? "mic" : "ear"} size={18} />
                {myTurn
                  ? "Твой ход. Поделись мыслью — тебя слушают."
                  : `Сейчас слушаем ${speaker.name}. Подними руку, чтобы ответить.`}
              </span>
              <strong>
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </strong>
            </div>
          )}
          <div className={`video-grid ${state.members.length === 1 ? "solo" : ""}`}>
            {state.members.map((member) => (
              <VideoTile
                key={member.id}
                member={member}
                self={member.id === selfId}
                speaking={state.phase === "running" && state.speakerId === member.id}
                stream={member.id === selfId ? localStream : remoteStreams[member.id]}
                peerStatus={peerStatus[member.id]}
              />
            ))}
          </div>
          {state.members.length === 1 && (
            <div className="invite-empty">
              <span>
                <Icon name="dialogue" size={22} />
              </span>
              <div>
                <h3>Разговор начинается с приглашения</h3>
                <p>Поделись ссылкой с участниками. Они появятся здесь после входа.</p>
              </div>
              <button className="section-link" onClick={copyInvite}>
                Скопировать ссылку <Icon name="arrow" size={16} />
              </button>
            </div>
          )}
          {!localStream && (
            <div className="media-request">
              <Icon name="camera" size={24} />
              <div>
                <strong>Добавь живой голос</strong>
                <p>Разрешение на камеру и микрофон запросим по нажатию.</p>
              </div>
              <button className="button secondary" onClick={() => void room.enableMedia()}>
                Подключить камеру и звук
              </button>
            </div>
          )}
          {mediaError && (
            <p className="media-error" role="alert">
              {mediaError}
            </p>
          )}
          <div className="call-controls">
            <div className="media-controls">
              <button
                className={`control-button ${micOn ? "enabled" : ""}`}
                onClick={() => void room.toggleMic()}
                disabled={!localStream || (state.phase === "running" && !myTurn)}
                title={
                  state.phase === "running" && !myTurn
                    ? "Микрофон доступен в твой ход"
                    : "Управление микрофоном"
                }
                aria-label={micOn ? "Выключить микрофон" : "Включить микрофон"}
              >
                <Icon name="mic" size={21} />
                {!micOn && <span className="control-slash" />}
              </button>
              <button
                className={`control-button ${cameraOn ? "enabled" : ""}`}
                onClick={() => void room.toggleCamera()}
                disabled={!localStream}
                aria-label={cameraOn ? "Выключить камеру" : "Включить камеру"}
              >
                <Icon name="camera" size={21} />
                {!cameraOn && <span className="control-slash" />}
              </button>
            </div>
            <div className="turn-controls">
              {myTurn ? (
                <button className="button primary" onClick={() => room.send({ type: "done" })}>
                  <Icon name="check" size={18} /> Я закончил
                </button>
              ) : (
                <button
                  className={`button ${own?.hand ? "primary" : "secondary"}`}
                  disabled={state.phase === "ended" || status !== "connected"}
                  onClick={() => room.send({ type: own?.hand ? "lower" : "raise" })}
                >
                  <Icon name="hand" size={18} />
                  {own?.hand ? "Опустить руку" : "Поднять руку"}
                </button>
              )}
            </div>
            <span className="control-hint">
              {myTurn ? "Включи микрофон для ответа" : "Говорим по очереди"}
            </span>
          </div>
          {isHost && (
            <div className="host-controls">
              <span>
                <Icon name="campus" size={17} /> Управление ведущего
              </span>
              <div>
                {state.phase === "ready" && (
                  <button
                    className="button primary compact"
                    onClick={() => room.send({ type: "start" })}
                  >
                    <Icon name="play" size={15} /> Начать
                  </button>
                )}
                {state.phase === "running" && (
                  <button
                    className="button secondary compact"
                    onClick={() => room.send({ type: "pause" })}
                  >
                    <Icon name="pause" size={15} /> Пауза
                  </button>
                )}
                {state.phase === "paused" && (
                  <button
                    className="button primary compact"
                    onClick={() => room.send({ type: "start" })}
                  >
                    <Icon name="play" size={15} /> Продолжить
                  </button>
                )}
                {(state.phase === "running" || state.phase === "paused") && (
                  <button
                    className="button secondary compact"
                    onClick={() => room.send({ type: "next" })}
                  >
                    <Icon name="next" size={15} /> Следующий
                  </button>
                )}
                {state.phase === "ended" && (
                  <button
                    className="button primary compact"
                    onClick={() => room.send({ type: "reset" })}
                  >
                    <Icon name="refresh" size={15} /> Повторить
                  </button>
                )}
                <label className="turn-time">
                  Ход
                  <select
                    aria-label="Время хода"
                    value={state.turnSeconds}
                    onChange={(e) =>
                      room.send({ type: "settings", turnSeconds: Number(e.target.value) })
                    }
                  >
                    {[30, 60, 90, 120, 180].map((n) => (
                      <option value={n} key={n}>
                        {n} сек.
                      </option>
                    ))}
                  </select>
                </label>
                {state.phase !== "ended" && (
                  <button className="end-session" onClick={() => setEndModal(true)}>
                    Завершить
                  </button>
                )}
              </div>
            </div>
          )}
          {state.phase === "ended" && (
            <div className="end-summary">
              <Icon name="check" size={26} />
              <div>
                <h3>Спасибо за разговор</h3>
                <p>
                  Твоих ходов: {own?.turns || 0}. Микрофон был включён в свой ход{" "}
                  {Math.round(own?.spokeSeconds || 0)} сек. Это не оценка речи.
                </p>
              </div>
              <button className="button secondary compact" onClick={onLeave}>
                Сохранить и выйти
              </button>
            </div>
          )}
          <p className="room-privacy">
            <Icon name="help" size={13} /> Звонок не записывается. Модератор работает по учебному
            сценарию.
          </p>
        </section>
        <aside className="room-panel">
          <div className="coach-card">
            <div className="coach-heading">
              <span className="coach-symbol">✳</span>
              <div>
                <strong>AI-модератор</strong>
                <small>Учебный сценарий</small>
              </div>
              <span className="coach-tag">СЦЕНАРИЙ</span>
            </div>
            <span className="eyebrow">ЗАДАНИЕ ДЛЯ РАЗГОВОРА</span>
            <p>{state.prompt}</p>
            <button className="coach-read" onClick={readPrompt} disabled={!tts}>
              <Icon name="volume" size={16} />
              {speakingPrompt
                ? "Остановить озвучку"
                : tts
                  ? "Послушать задание"
                  : "Озвучка недоступна"}
            </button>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="Комната">
            <button
              id="queue-tab"
              role="tab"
              aria-selected={tab === "queue"}
              aria-controls="queue-panel"
              onClick={() => setTab("queue")}
              className={tab === "queue" ? "active" : ""}
            >
              Участники <span>{state.members.length}</span>
            </button>
            <button
              id="chat-tab"
              role="tab"
              aria-selected={tab === "chat"}
              aria-controls="chat-panel"
              onClick={() => setTab("chat")}
              className={tab === "chat" ? "active" : ""}
            >
              Чат <Icon name="dialogue" size={15} />
            </button>
          </div>
          {tab === "queue" ? (
            <div
              id="queue-panel"
              role="tabpanel"
              aria-labelledby="queue-tab"
              className="queue-panel"
            >
              <div className="queue-title">
                <span className="eyebrow">ОЧЕРЕДЬ НА СЛОВО</span>
                <span>{state.queue.length}</span>
              </div>
              {state.queue.length ? (
                <ol className="speaker-queue">
                  {state.queue.map((id, index) => {
                    const member = state.members.find((m) => m.id === id);
                    return member ? (
                      <li key={id}>
                        <span className="queue-number">{index + 1}</span>
                        <span>
                          {member.name}
                          {id === selfId && " (ты)"}
                        </span>
                        {isHost && (
                          <button
                            aria-label={`Дать слово: ${member.name}`}
                            title="Дать слово"
                            onClick={() => room.send({ type: "grant", targetId: id })}
                          >
                            <Icon name="mic" size={15} />
                          </button>
                        )}
                      </li>
                    ) : null;
                  })}
                </ol>
              ) : (
                <div className="queue-empty">
                  <Icon name="hand" size={24} />
                  <p>
                    Пока никто не поднял руку.
                    <br />
                    Каждый может начать.
                  </p>
                </div>
              )}
              <div className="queue-title all-members-title">
                <span className="eyebrow">В КОМНАТЕ</span>
              </div>
              <ul className="member-list">
                {state.members.map((member) => (
                  <li key={member.id}>
                    <span className="member-avatar">{initials(member.name)}</span>
                    <div>
                      <strong>
                        {member.name}
                        {member.id === selfId && " (ты)"}
                      </strong>
                      <small>
                        {member.isHost
                          ? "Ведущий"
                          : state.speakerId === member.id
                            ? "Сейчас говорит"
                            : member.hand
                              ? "Ждёт слово"
                              : "Участник"}
                      </small>
                    </div>
                    {isHost && member.id !== selfId ? (
                      <div className="member-actions">
                        <button
                          className="icon-button"
                          aria-label={`Дать слово: ${member.name}`}
                          title="Дать слово"
                          onClick={() => room.send({ type: "grant", targetId: member.id })}
                        >
                          <Icon name="wave" size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Выключить микрофон: ${member.name}`}
                          title="Выключить микрофон"
                          disabled={!member.mic}
                          onClick={() => room.send({ type: "mute", targetId: member.id })}
                        >
                          <Icon name="mic" size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className={`member-mic ${member.mic ? "on" : ""}`}>
                        <Icon name="mic" size={15} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div id="chat-panel" role="tabpanel" aria-labelledby="chat-tab" className="chat-panel">
              <div
                className="chat-messages"
                role="log"
                aria-label="Сообщения комнаты"
                aria-live="polite"
              >
                {!state.messages.length && (
                  <p className="chat-empty">
                    Здесь можно задать вопрос или поддержать собеседника.
                  </p>
                )}
                {state.messages.map((message) => (
                  <article className={`chat-message ${message.kind}`} key={message.id}>
                    <div>
                      <strong>{message.name}</strong>
                      <span>
                        {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p>{message.text}</p>
                  </article>
                ))}
                <div ref={chatEnd} />
              </div>
              <form className="chat-form" onSubmit={sendChat}>
                <input
                  aria-label="Сообщение в чат"
                  placeholder="Написать сообщение…"
                  value={text}
                  maxLength={1000}
                  onChange={(e) => setText(e.target.value)}
                  disabled={status !== "connected"}
                />
                <button
                  aria-label="Отправить сообщение"
                  disabled={!text.trim() || status !== "connected"}
                >
                  <Icon name="arrow" size={18} />
                </button>
              </form>
            </div>
          )}
          <div className="room-panel-foot">
            <Icon name="ear" size={16} />
            <p>
              Сначала слушаем. Потом отвечаем.
              <br />
              Можно попросить паузу у ведущего.
            </p>
          </div>
        </aside>
      </div>
      {copyText && (
        <div className="room-copy-notice" role="status">
          <Icon name="check" size={16} />
          <span>{copyText}</span>
          <button className="icon-button" aria-label="Закрыть" onClick={() => setCopyText("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {endModal && (
        <Modal
          title="Завершим этот разговор?"
          subtitle="Комната останется открытой. Ведущий сможет запустить практику ещё раз."
          onClose={() => setEndModal(false)}
        >
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setEndModal(false)}>
              Продолжить занятие
            </button>
            <button
              className="button primary"
              onClick={() => {
                room.send({ type: "end" });
                setEndModal(false);
              }}
            >
              Завершить
            </button>
          </div>
        </Modal>
      )}
      {help}
    </div>
  );
}
