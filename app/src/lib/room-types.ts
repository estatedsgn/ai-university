export type RoomTopic = 'listening' | 'speaking' | 'english' | 'debate';
export type RoomPhase = 'ready' | 'running' | 'paused' | 'ended';

export const LESSONS: Record<RoomTopic, { title: string; description: string; prompt: string; duration: number }> = {
  listening: { title: 'Искусство слушать', description: 'Говорите по очереди и учитесь понимать друг друга.', prompt: 'Расскажите о важном для вас событии. Следующий участник сначала пересказывает услышанное своими словами, затем делится своим примером.', duration: 60 },
  speaking: { title: 'Уверенная речь', description: 'Короткие выступления и ясные мысли.', prompt: 'За одну минуту расскажите об идее, которой хотите поделиться. Начните с главной мысли и добавьте один конкретный пример.', duration: 60 },
  english: { title: 'Разговорный английский', description: 'Практика английского в небольшом кругу.', prompt: 'Tell us about a place you would like to visit and why. The next speaker asks one question before sharing their own answer.', duration: 60 },
  debate: { title: 'Диалог и аргументы', description: 'Учитесь отстаивать позицию с уважением к собеседнику.', prompt: 'Должны ли школы начинаться позже утром? Сначала кратко повторите аргумент предыдущего участника, затем приведите свой довод за или против.', duration: 60 },
};

export interface RoomMember {
  id: string;
  name: string;
  isHost: boolean;
  mic: boolean;
  camera: boolean;
  hand: boolean;
  joinedAt: number;
  turns: number;
  /** Time with microphone enabled during this participant\'s turn; not a speech-recognition score. */
  spokeSeconds: number;
}
export interface RoomMessage {
  id: string;
  kind: 'coach' | 'chat' | 'system';
  memberId?: string;
  name: string;
  text: string;
  createdAt: number;
}
export interface RoomState {
  members: RoomMember[];
  queue: string[];
  speakerId: string | null;
  phase: RoomPhase;
  topic: RoomTopic;
  turnEndsAt: number | null;
  turnSeconds: number;
  prompt: string;
  messages: RoomMessage[];
  serverNow: number;
  revision: number;
}
export interface SignalData {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
}
export type ClientMessage =
  | { type: 'media'; mic: boolean; camera: boolean }
  | { type: 'raise' | 'lower' | 'done' }
  | { type: 'chat'; text: string }
  | { type: 'signal'; targetId: string; data: SignalData }
  | { type: 'start' | 'pause' | 'next' | 'reset' | 'end' }
  | { type: 'grant' | 'mute'; targetId: string }
  | { type: 'topic'; topic: RoomTopic }
  | { type: 'settings'; turnSeconds: number }
  | { type: 'ping' };
export type ServerMessage =
  | { type: 'welcome'; id: string; isHost: boolean }
  | { type: 'state'; state: RoomState }
  | { type: 'signal'; fromId: string; data: SignalData }
  | { type: 'mute'; targetId: string }
  | { type: 'error'; message: string; code: string }
  | { type: 'pong'; serverNow: number };
