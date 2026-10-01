import { DurableObject } from 'cloudflare:workers';
import type { DurableObjectNamespace, DurableObjectState, WebSocket as WorkerSocket } from '@cloudflare/workers-types';
import { LESSONS, type RoomMember, type RoomState, type RoomTopic, type ServerMessage, type SignalData } from './room-types';

declare const WebSocketPair: new () => { 0: WorkerSocket; 1: WorkerSocket };
type RoomEnv = { ROOMS?: DurableObjectNamespace };
type Attachment = { member: RoomMember; windowAt: number; count: number; actions: number; chatAt: number };
type StoredRoom = { state: RoomState; hostDigest: string; expiresAt: number; micSince: Record<string, number>; pausedMs: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = 86400000;
const HOUR = 3600000;
const HOST_ACTIONS = new Set(['start', 'pause', 'next', 'reset', 'end', 'grant', 'mute', 'topic', 'settings']);
const json = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store', ...headers } });
const isTopic = (value: unknown): value is RoomTopic => typeof value === 'string' && Object.prototype.hasOwnProperty.call(LESSONS, value);
const cleanText = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const cookieName = (id: string) => 'aiu_host_' + id;
async function smallBody(request: Request, maximum: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader(); const decoder = new TextDecoder(); let text = ''; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maximum) { await reader.cancel(); return null; }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function equalDigest(a: string, b: string) { let result = a.length ^ b.length; for (let i = 0; i < 64; i++) result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return result === 0; }
function readCookie(request: Request, name: string) {
  for (const cookie of (request.headers.get('cookie') || '').split(';')) { const index = cookie.indexOf('='); if (cookie.slice(0, index).trim() === name) return cookie.slice(index + 1).trim(); }
  return '';
}

/** Rooms are accessible to anyone possessing the random room URL. Owner authority is a separate HttpOnly cookie. */
export async function handleRooms(request: Request, environment: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/connect$/);
  if (url.pathname !== '/api/rooms' && !match) return null;
  const env = environment as RoomEnv;
  if (!env?.ROOMS) return json({ error: 'Комнаты пока недоступны. Попробуйте позже.' }, 503);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'Запрос с другого сайта запрещён.' }, 403);
  if (url.pathname === '/api/rooms') {
    if (request.method !== 'POST') return json({ error: 'Используйте POST.' }, 405, { Allow: 'POST' });
    if (origin !== url.origin) return json({ error: 'Создавайте комнату с этого сайта.' }, 403);
    if (Number(request.headers.get('content-length') || 0) > 2048) return json({ error: 'Слишком большой запрос.' }, 413);
    let body: Record<string, unknown> = {};
    try { const text = await smallBody(request, 2048); if (text === null) return json({ error: 'Слишком большой запрос.' }, 413); body = text ? JSON.parse(text) : {}; if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Некорректные настройки.' }, 400); } catch { return json({ error: 'Некорректный JSON.' }, 400); }
    if (body.topic !== undefined && !isTopic(body.topic)) return json({ error: 'Неизвестный урок.' }, 400);
    const topic: RoomTopic = isTopic(body.topic) ? body.topic : 'listening';
    const turnSeconds = typeof body.turnSeconds === 'number' && Number.isInteger(body.turnSeconds) && body.turnSeconds >= 15 && body.turnSeconds <= 180 ? body.turnSeconds : LESSONS[topic].duration;
    // Cloudflare supplies this header; only its SHA-256 digest becomes a Durable Object name.
    const sourceHash = await digest(request.headers.get('cf-connecting-ip') || 'unknown');
    const rate = await env.ROOMS.get(env.ROOMS.idFromName('create-rate:' + sourceHash)).fetch('https://room.internal/__rate', { method: 'POST' });
    if (rate.status === 429) return json({ error: 'Лимит: 30 новых комнат в час. Попробуйте позже.' }, 429, { 'retry-after': rate.headers.get('retry-after') || '3600' });
    if (!rate.ok) return json({ error: 'Не удалось проверить лимит создания комнат.' }, 503);
    const roomId = crypto.randomUUID();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
    const stub = env.ROOMS.get(env.ROOMS.idFromName(roomId));
    const result = await stub.fetch('https://room.internal/__init', { method: 'POST', body: JSON.stringify({ hostDigest: await digest(token), topic, turnSeconds }) });
    if (!result.ok) return json({ error: 'Не удалось создать комнату.' }, 503);
    return json({ roomId }, 201, { 'set-cookie': cookieName(roomId) + '=' + token + '; Path=/api/rooms/' + roomId + '; HttpOnly; Secure; SameSite=Strict; Max-Age=86400' });
  }
  if (!match || !UUID.test(match[1])) return json({ error: 'Комната не найдена.' }, 404);
  if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Требуется WebSocket.' }, 426, { Upgrade: 'websocket' });
  // Browsers send Origin on every WebSocket handshake: verify it before accepting owner cookies.
  if (origin !== url.origin) return json({ error: 'Подключение с другого сайта запрещено.' }, 403);
  const roomId = match[1].toLowerCase();
  const headers = new Headers(request.headers);
  headers.delete('x-aiu-owner');
  headers.set('x-aiu-owner', readCookie(request, cookieName(roomId)));
  const forwarded = new Request(request.url, { method: 'GET', headers });
  return await env.ROOMS.get(env.ROOMS.idFromName(roomId)).fetch(forwarded as any) as unknown as Response;
}

/** Signaling/control only. Media is browser-to-browser WebRTC; mute is cooperative track.enabled, not SFU enforcement.
 * This moderator runs the fixed lesson scripts in LESSONS. It does not call an LLM, inspect speech, or record media.
 * Browser STUN-only connectivity can fail behind restrictive NAT/firewalls; reliable relay requires a configured TURN service.
 */
export class Rooms extends DurableObject<RoomEnv> {
  private room: StoredRoom | null = null;
  private ready: Promise<void>;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get<StoredRoom>('room') || null;
      if (!this.room) return;
      const ids = new Set(ctx.getWebSockets().map(socket => (socket.deserializeAttachment() as Attachment | null)?.member.id));
      this.room.state.members = this.room.state.members.filter(member => ids.has(member.id));
      this.room.state.queue = this.room.state.queue.filter(id => ids.has(id));
      for (const id of Object.keys(this.room.micSince)) if (!ids.has(id)) delete this.room.micSince[id];
      if (this.room.state.speakerId && !ids.has(this.room.state.speakerId)) { this.room.state.speakerId = null; this.room.state.turnEndsAt = null; if (this.room.state.phase === 'running') this.nextTurn(); }
    });
  }
  // Awaiting storage must not let two guest hand raises reorder a shared queue.
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(async () => { await this.ready; return operation(); });
    this.pending = result.catch(() => {});
    return result;
  }
  private send(socket: WorkerSocket, message: ServerMessage) { try { socket.send(JSON.stringify(message)); } catch { /* close handler removes the member */ } }
  private sockets() { return this.ctx.getWebSockets(); }
  private snapshot(): RoomState {
    const room = this.room!; const now = Date.now();
    return { ...room.state, serverNow: now, members: room.state.members.map(member => ({ ...member, spokeSeconds: member.spokeSeconds + (room.micSince[member.id] ? Math.max(0, now - room.micSince[member.id]) / 1000 : 0) })) };
  }
  private async save() {
    if (!this.room) return;
    this.room.state.serverNow = Date.now();
    await this.ctx.storage.put('room', this.room);
    const deadline = this.room.state.phase === 'running' ? this.room.state.turnEndsAt : null;
    await this.ctx.storage.setAlarm(Math.min(this.room.expiresAt, deadline || this.room.expiresAt));
  }
  private async publish() {
    if (!this.room) return;
    this.room.state.revision++;
    await this.save();
    const message: ServerMessage = { type: 'state', state: this.snapshot() };
    for (const socket of this.sockets()) {
      const attachment = socket.deserializeAttachment() as Attachment | null;
      const member = this.room.state.members.find(item => item.id === attachment?.member.id);
      if (attachment && member) { attachment.member = member; socket.serializeAttachment(attachment); this.send(socket, message); }
    }
  }
  private note(text: string, kind: 'coach' | 'system' = 'coach') {
    const messages = this.room!.state.messages;
    messages.push({ id: crypto.randomUUID(), kind, name: kind === 'coach' ? 'AI-ведущий' : 'Комната', text, createdAt: Date.now() });
    if (messages.length > 80) messages.splice(0, messages.length - 80);
  }
  private accrue(member: RoomMember) {
    const since = this.room!.micSince[member.id];
    if (since) { member.spokeSeconds += Math.max(0, Date.now() - since) / 1000; delete this.room!.micSince[member.id]; }
  }
  private silence() { for (const member of this.room!.state.members) { this.accrue(member); member.mic = false; } }
  private nextTurn(targetId?: string) {
    const state = this.room!.state;
    this.silence();
    state.speakerId = null; state.turnEndsAt = null;
    state.queue = state.queue.filter(id => state.members.some(member => member.id === id));
    const id = targetId || state.queue.shift();
    if (!id) { this.note('Круг завершён. Поднимите руку, чтобы продолжить, или завершите занятие и обсудите впечатления.'); return; }
    const member = state.members.find(item => item.id === id);
    if (!member) return;
    state.queue = state.queue.filter(queued => queued !== id);
    member.hand = false; member.turns++;
    state.speakerId = id; state.turnEndsAt = Date.now() + state.turnSeconds * 1000;
    this.room!.pausedMs = 0;
    this.note('Слово у ' + member.name + '. Включите микрофон, когда будете готовы. Остальные слушают. ' + state.prompt);
  }
  fetch(request: any): Promise<any> {
    return this.serial(async () => {
      const url = new URL(request.url);
      // Only handleRooms can route to this internal endpoint; public room routes require a UUID.
      if (url.pathname === '/__rate' && request.method === 'POST') {
        const now = Date.now();
        let rate = await this.ctx.storage.get<{ windowAt: number; count: number }>('create-rate');
        if (!rate || now - rate.windowAt >= HOUR) rate = { windowAt: now, count: 0 };
        if (rate.count >= 30) return json({ error: 'rate_limit' }, 429, { 'retry-after': String(Math.max(1, Math.ceil((rate.windowAt + HOUR - now) / 1000))) });
        rate.count++;
        await this.ctx.storage.put('create-rate', rate);
        await this.ctx.storage.setAlarm(rate.windowAt + HOUR);
        return json({ ok: true });
      }
      if (url.pathname === '/__init' && request.method === 'POST') {
        if (this.room) return json({ error: 'Комната уже существует.' }, 409);
        const body = await request.json();
        if (!/^[a-f0-9]{64}$/.test(body.hostDigest) || !isTopic(body.topic)) return json({ error: 'Некорректные настройки.' }, 400);
        const topic: RoomTopic = body.topic;
        this.room = { hostDigest: body.hostDigest, expiresAt: Date.now() + DAY, micSince: {}, pausedMs: 0, state: {
          members: [], queue: [], speakerId: null, phase: 'ready', topic, turnEndsAt: null,
          turnSeconds: Number.isInteger(body.turnSeconds) && body.turnSeconds >= 15 && body.turnSeconds <= 180 ? body.turnSeconds : LESSONS[topic].duration,
          prompt: LESSONS[topic].prompt, messages: [], serverNow: Date.now(), revision: 0,
        } };
        this.note('Добро пожаловать! Я сценарный AI-ведущий. Помогу говорить по очереди и слушать друг друга. Организатор запускает занятие; слово получаем по очереди, а микрофон каждый включает самостоятельно.');
        await this.save(); return json({ ok: true });
      }
      if (!this.room || this.room.expiresAt <= Date.now()) return json({ error: 'Комната не найдена или срок её действия истёк.' }, 404);
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Требуется WebSocket.' }, 426);
      const token = request.headers.get('x-aiu-owner') || '';
      const isHost = /^[a-f0-9]{64}$/.test(token) && equalDigest(await digest(token), this.room.hostDigest);
      // One active owner tab. Reopening the owner's link safely replaces their previous socket.
      if (isHost) for (const socket of this.sockets()) {
        const old = socket.deserializeAttachment() as Attachment | null;
        if (old?.member.isHost) { this.removeMember(old.member.id); socket.close(4002, 'Открыта другая вкладка владельца'); }
      }
      if (this.room.state.members.length >= 6) return json({ error: 'В комнате уже шесть участников.' }, 409);
      const member: RoomMember = { id: crypto.randomUUID(), name: cleanText(url.searchParams.get('name'), 36) || (isHost ? 'Организатор' : 'Участник'), isHost, mic: false, camera: false, hand: false, joinedAt: Date.now(), turns: 0, spokeSeconds: 0 };
      const pair = new WebSocketPair(); const client = pair[0]; const server = pair[1];
      server.serializeAttachment({ member, windowAt: Date.now(), count: 0, actions: 0, chatAt: 0 } satisfies Attachment);
      this.ctx.acceptWebSocket(server, [member.id]);
      this.room.state.members.push(member);
      this.send(server, { type: 'welcome', id: member.id, isHost });
      this.note(member.name + ' присоединился к комнате.', 'system');
      await this.publish();
      return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WorkerSocket });
    });
  }
  private error(socket: WorkerSocket, code: string, message: string) { this.send(socket, { type: 'error', code, message }); }
  private signal(socket: WorkerSocket, sender: RoomMember, body: Record<string, any>) {
    if (typeof body.targetId !== 'string' || body.targetId === sender.id || !this.room!.state.members.some(member => member.id === body.targetId)) return this.error(socket, 'peer_missing', 'Участник уже вышел.');
    const input = body.data;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return this.error(socket, 'invalid_signal', 'Некорректный сигнал.');
    const data: SignalData = {};
    if (input.description !== undefined) {
      const description = input.description;
      if (!description || !['offer', 'answer'].includes(description.type) || typeof description.sdp !== 'string' || description.sdp.length > 32768) return this.error(socket, 'invalid_signal', 'Некорректное описание соединения.');
      data.description = { type: description.type, sdp: description.sdp };
    }
    if (Object.prototype.hasOwnProperty.call(input, 'candidate')) {
      const candidate = input.candidate;
      if (candidate === null) data.candidate = null;
      else {
        if (!candidate || typeof candidate !== 'object' || typeof candidate.candidate !== 'string' || candidate.candidate.length > 2048 || (candidate.sdpMid != null && (typeof candidate.sdpMid !== 'string' || candidate.sdpMid.length > 128)) || (candidate.sdpMLineIndex != null && (!Number.isInteger(candidate.sdpMLineIndex) || candidate.sdpMLineIndex < 0 || candidate.sdpMLineIndex > 32)) || (candidate.usernameFragment != null && (typeof candidate.usernameFragment !== 'string' || candidate.usernameFragment.length > 128))) return this.error(socket, 'invalid_signal', 'Некорректный ICE-кандидат.');
        data.candidate = { candidate: candidate.candidate, sdpMid: candidate.sdpMid ?? null, sdpMLineIndex: candidate.sdpMLineIndex ?? null, usernameFragment: candidate.usernameFragment };
      }
    }
    if (!data.description && !Object.prototype.hasOwnProperty.call(data, 'candidate')) return this.error(socket, 'invalid_signal', 'Пустой сигнал.');
    for (const target of this.sockets()) if ((target.deserializeAttachment() as Attachment | null)?.member.id === body.targetId) this.send(target, { type: 'signal', fromId: sender.id, data });
  }
  webSocketMessage(socket: WorkerSocket, raw: string | ArrayBuffer): Promise<void> {
    return this.serial(async () => {
      if (!this.room) return;
      const attachment = socket.deserializeAttachment() as Attachment | null;
      const member = this.room.state.members.find(item => item.id === attachment?.member.id);
      if (!attachment || !member) return;
      if (typeof raw !== 'string' || raw.length > 65536) { this.error(socket, 'message_size', 'Слишком большое сообщение.'); socket.close(1009, 'Message too large'); this.removeMember(member.id); await this.publish(); return; }
      let body: Record<string, any>;
      try { body = JSON.parse(raw); if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.type !== 'string') throw new Error(); } catch { this.error(socket, 'invalid_message', 'Некорректное сообщение.'); return; }
      const now = Date.now();
      if (now - attachment.windowAt >= 10000) { attachment.windowAt = now; attachment.count = 0; attachment.actions = 0; }
      attachment.count++;
      if (body.type !== 'signal' && body.type !== 'ping') attachment.actions++;
      socket.serializeAttachment(attachment);
      if (attachment.count > 240 || attachment.actions > 40) { this.error(socket, 'rate_limit', 'Слишком много действий. Подождите несколько секунд.'); return; }
      if (this.room.expiresAt <= now) { await this.expire(); return; }
      if (this.room.state.phase === 'running' && this.room.state.turnEndsAt && this.room.state.turnEndsAt <= now) { this.nextTurn(); await this.publish(); }
      if (HOST_ACTIONS.has(body.type) && !member.isHost) { this.error(socket, 'host_only', 'Это действие доступно только организатору.'); return; }
      const state = this.room.state;
      switch (body.type) {
        case 'ping': this.send(socket, { type: 'pong', serverNow: now }); return;
        case 'signal': this.signal(socket, member, body); return;
        case 'media': {
          if (typeof body.mic !== 'boolean' || typeof body.camera !== 'boolean') { this.error(socket, 'invalid_media', 'Некорректное состояние устройств.'); return; }
          const mic = body.mic && state.phase === 'running' && state.speakerId === member.id;
          if (member.mic && !mic) this.accrue(member);
          if (!member.mic && mic) this.room.micSince[member.id] = now;
          member.mic = mic; member.camera = body.camera; break;
        }
        case 'raise':
          if (state.phase === 'ended') { this.error(socket, 'session_ended', 'Занятие завершено.'); return; }
          if (state.speakerId !== member.id && !state.queue.includes(member.id)) { member.hand = true; state.queue.push(member.id); if (state.phase === 'running' && !state.speakerId) this.nextTurn(); }
          break;
        case 'lower': member.hand = false; state.queue = state.queue.filter(id => id !== member.id); break;
        case 'done':
          if (state.speakerId !== member.id || state.phase !== 'running') { this.error(socket, 'not_speaker', 'Сейчас слово у другого участника.'); return; }
          this.nextTurn(); break;
        case 'chat': {
          const text = cleanText(body.text, 500);
          if (!text) { this.error(socket, 'empty_message', 'Напишите сообщение.'); return; }
          if (now - attachment.chatAt < 700) { this.error(socket, 'chat_rate', 'Отправляйте сообщения чуть медленнее.'); return; }
          attachment.chatAt = now; socket.serializeAttachment(attachment);
          state.messages.push({ id: crypto.randomUUID(), kind: 'chat', memberId: member.id, name: member.name, text, createdAt: now });
          if (state.messages.length > 80) state.messages.splice(0, state.messages.length - 80);
          break;
        }
        case 'start':
          if (state.phase === 'ended') { this.error(socket, 'session_ended', 'Сначала начните новый круг.'); return; }
          if (state.phase === 'running') return;
          if (state.phase === 'paused' && state.speakerId) {
            state.phase = 'running'; state.turnEndsAt = now + (this.room.pausedMs || state.turnSeconds * 1000); this.room.pausedMs = 0;
            this.note('Продолжаем. Текущий участник может снова включить микрофон.');
          } else {
            state.phase = 'running';
            if (!state.queue.length) state.queue = state.members.filter(item => !item.isHost).map(item => item.id);
            if (!state.queue.length) state.queue = [member.id];
            this.nextTurn();
          }
          break;
        case 'pause':
          if (state.phase !== 'running') return;
          this.room.pausedMs = state.turnEndsAt ? Math.max(1, state.turnEndsAt - now) : 0;
          state.phase = 'paused'; state.turnEndsAt = null; this.silence();
          this.note('Пауза. Подумайте о том, что услышали. Микрофоны выключены; организатор продолжит занятие.'); break;
        case 'next':
          if (state.phase !== 'running' && state.phase !== 'paused') { this.error(socket, 'not_started', 'Сначала начните занятие.'); return; }
          state.phase = 'running'; this.nextTurn(); break;
        case 'grant': {
          if (state.phase === 'ended') { this.error(socket, 'session_ended', 'Сначала начните новый круг.'); return; }
          const target = state.members.find(item => item.id === body.targetId);
          if (!target) { this.error(socket, 'peer_missing', 'Участник уже вышел.'); return; }
          state.phase = 'running'; this.nextTurn(target.id); break;
        }
        case 'mute': {
          const target = state.members.find(item => item.id === body.targetId);
          if (!target) { this.error(socket, 'peer_missing', 'Участник уже вышел.'); return; }
          this.accrue(target); target.mic = false;
          for (const peer of this.sockets()) this.send(peer, { type: 'mute', targetId: target.id });
          break;
        }
        case 'reset':
          this.silence(); state.phase = 'ready'; state.speakerId = null; state.turnEndsAt = null; state.queue = []; this.room.pausedMs = 0;
          for (const item of state.members) { item.hand = false; item.turns = 0; item.spokeSeconds = 0; }
          this.note('Новый круг готов. Каждый включает микрофон сам, когда получит слово.'); break;
        case 'end':
          this.silence(); state.phase = 'ended'; state.speakerId = null; state.turnEndsAt = null; state.queue = []; this.room.pausedMs = 0;
          for (const item of state.members) item.hand = false;
          this.note('Занятие завершено. Спасибо за внимание друг к другу! Что вы запомнили из выступления другого человека? Отчёт показывает количество ходов и время включённого микрофона; качество речи я не оцениваю.'); break;
        case 'topic':
          if (!isTopic(body.topic)) { this.error(socket, 'invalid_topic', 'Неизвестный урок.'); return; }
          if (state.phase === 'running' || state.phase === 'paused') { this.error(socket, 'session_started', 'Меняйте урок перед началом нового круга.'); return; }
          state.topic = body.topic; state.prompt = LESSONS[body.topic].prompt;
          this.note('Выбран урок: ' + LESSONS[body.topic].title + '. ' + state.prompt); break;
        case 'settings':
          if (!Number.isInteger(body.turnSeconds) || body.turnSeconds < 15 || body.turnSeconds > 180) { this.error(socket, 'invalid_duration', 'Выберите от 15 до 180 секунд.'); return; }
          if (state.phase === 'running') { this.error(socket, 'session_started', 'Сначала поставьте занятие на паузу.'); return; }
          state.turnSeconds = body.turnSeconds; break;
        default: this.error(socket, 'unknown_action', 'Неизвестное действие.'); return;
      }
      await this.publish();
    });
  }
  private removeMember(id: string) {
    if (!this.room) return;
    const state = this.room.state; const member = state.members.find(item => item.id === id);
    if (!member) return;
    this.accrue(member); state.members = state.members.filter(item => item.id !== id); state.queue = state.queue.filter(queued => queued !== id);
    this.note(member.name + ' вышел из комнаты.', 'system');
    if (state.speakerId === id) {
      state.speakerId = null; state.turnEndsAt = null; this.room.pausedMs = 0;
      if (state.phase === 'running') this.nextTurn();
    }
  }
  webSocketClose(socket: WorkerSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    try { socket.close(1000, 'Connection closed'); } catch { /* close handshake already completed */ }
    return this.serial(async () => {
      const attachment = socket.deserializeAttachment() as Attachment | null;
      if (!this.room || !attachment || !this.room.state.members.some(member => member.id === attachment.member.id)) return;
      this.removeMember(attachment.member.id); await this.publish();
    });
  }
  webSocketError(socket: WorkerSocket): Promise<void> {
    try { socket.close(1011, 'Connection error'); } catch { /* already closed */ }
    return this.webSocketClose(socket, 1011, 'Connection error', false);
  }
  private async expire() {
    for (const socket of this.sockets()) { this.error(socket, 'expired', 'Срок действия комнаты истёк. Создайте новую.'); try { socket.close(4001, 'Room expired'); } catch { /* already closed */ } }
    this.room = null; await this.ctx.storage.deleteAll(); await this.ctx.storage.deleteAlarm();
  }
  alarm(): Promise<void> {
    return this.serial(async () => {
      if (!this.room) {
        const rate = await this.ctx.storage.get<{ windowAt: number; count: number }>('create-rate');
        if (rate && Date.now() >= rate.windowAt + HOUR) { await this.ctx.storage.delete('create-rate'); await this.ctx.storage.deleteAlarm(); }
        else if (rate) await this.ctx.storage.setAlarm(rate.windowAt + HOUR);
        return;
      }
      if (Date.now() >= this.room.expiresAt) { await this.expire(); return; }
      const state = this.room.state;
      if (state.phase === 'running' && state.turnEndsAt && state.turnEndsAt <= Date.now()) { this.nextTurn(); await this.publish(); }
      else await this.save();
    });
  }
}
