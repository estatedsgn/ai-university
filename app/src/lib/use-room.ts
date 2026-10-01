import { useCallback, useEffect, useState } from "react";
import type { ClientMessage, RoomState, ServerMessage } from "./room-types";

export type RoomConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";
export type RoomPeerStatus = "connecting" | "connected" | "disconnected" | "failed";

interface RoomSnapshot {
  state: RoomState | null;
  selfId: string | null;
  isHost: boolean;
  status: RoomConnectionStatus;
  error: string | null;
  mediaError: string | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerStatus: Record<string, RoomPeerStatus>;
  peerErrors: Record<string, string>;
  micOn: boolean;
  cameraOn: boolean;
}

interface Peer {
  pc: RTCPeerConnection;
  audio: RTCRtpTransceiver;
  video: RTCRtpTransceiver;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingAnswer: boolean;
  candidates: RTCIceCandidateInit[];
  incoming: Promise<void>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  restarted: boolean;
}

const emptySnapshot = (): RoomSnapshot => ({
  state: null,
  selfId: null,
  isHost: false,
  status: "idle",
  error: null,
  mediaError: null,
  localStream: null,
  remoteStreams: {},
  peerStatus: {},
  peerErrors: {},
  micOn: false,
  cameraOn: false,
});

const mediaMessage = (reason: unknown): string => {
  const name = reason instanceof Error ? reason.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Разрешите доступ к устройствам в настройках браузера и попробуйте ещё раз.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Браузер не нашёл камеру или микрофон. Можно продолжить без них.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Камера или микрофон заняты другим приложением. Освободите устройство и попробуйте снова.";
  }
  return "Не удалось подключить камеру или микрофон. Можно продолжить без них.";
};

/** Browser resources live here; constructing this controller is safe during SSR. */
class RoomController {
  private snapshot = emptySnapshot();
  private socket: WebSocket | null = null;
  private peers = new Map<string, Peer>();
  private stream: MediaStream | null = null;
  private epoch = 0;
  private micWanted = false;
  private cameraWanted = false;
  private reportedMedia = "";
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private clockOffset = 0;
  private micSlot = 0;
  private mediaRequest: Promise<void> | null = null;

  constructor(private readonly onChange: (snapshot: RoomSnapshot) => void) {}

  private publish(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onChange(this.snapshot);
  }

  private canSpeak() {
    return (
      this.snapshot.status === "connected" &&
      this.snapshot.state?.phase === "running" &&
      this.snapshot.state.speakerId === this.snapshot.selfId &&
      this.snapshot.selfId !== null &&
      (this.snapshot.state.turnEndsAt === null ||
        Date.now() + this.clockOffset < this.snapshot.state.turnEndsAt)
    );
  }

  private syncMedia() {
    const audio =
      this.stream?.getAudioTracks().filter((track) => track.readyState === "live") ?? [];
    const video =
      this.stream?.getVideoTracks().filter((track) => track.readyState === "live") ?? [];
    const micOn = this.micWanted && this.canSpeak() && audio.length > 0;
    const cameraOn = this.cameraWanted && this.snapshot.status === "connected" && video.length > 0;
    audio.forEach((track) => {
      track.enabled = micOn;
    });
    video.forEach((track) => {
      track.enabled = cameraOn;
    });
    if (micOn !== this.snapshot.micOn || cameraOn !== this.snapshot.cameraOn) {
      this.publish({ micOn, cameraOn });
    }
    const value = `${micOn}:${cameraOn}`;
    if (this.snapshot.status === "connected" && value !== this.reportedMedia) {
      if (this.send({ type: "media", mic: micOn, camera: cameraOn })) this.reportedMedia = value;
    }
  }

  send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  connect(roomId: string, name: string) {
    this.disconnect();
    if (typeof window === "undefined") return;
    if (!roomId || !name.trim()) {
      this.publish({ status: "error", error: "Введите имя и выберите комнату." });
      return;
    }
    const generation = this.epoch;
    this.publish({ status: "connecting" });
    const url = new URL(`/api/rooms/${encodeURIComponent(roomId)}/connect`, window.location.origin);
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("name", name.trim());
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.publish({ status: "error", error: "Не удалось подключиться к комнате." });
      return;
    }
    this.socket = socket;
    socket.onmessage = (event) => {
      if (generation !== this.epoch || this.socket !== socket) return;
      try {
        this.receive(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        this.publish({ error: "Не удалось прочитать сообщение комнаты." });
      }
    };
    socket.onerror = () => {
      if (generation !== this.epoch) return;
      this.publish({ error: "Соединение с комнатой прервано. Попробуйте подключиться снова." });
    };
    socket.onclose = () => {
      if (generation !== this.epoch || this.socket !== socket) return;
      const error = this.snapshot.error;
      this.disconnect();
      this.publish({
        status: "disconnected",
        error: error ?? "Соединение закрыто. Подключитесь снова.",
      });
    };
  }

  disconnect() {
    this.epoch += 1;
    this.micSlot += 1;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }
    for (const id of this.peers.keys()) this.removePeer(id);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.micWanted = false;
    this.cameraWanted = false;
    this.reportedMedia = "";
    this.mediaRequest = null;
    this.snapshot = emptySnapshot();
    this.onChange(this.snapshot);
  }

  private receive(message: ServerMessage) {
    if (message.type === "welcome") {
      this.publish({
        selfId: message.id,
        isHost: message.isHost,
        status: "connected",
        error: null,
      });
      this.syncMedia();
      if (this.snapshot.state) this.reconcilePeers(this.snapshot.state);
    } else if (message.type === "state") {
      const previous = this.snapshot.state;
      this.clockOffset = message.state.serverNow - Date.now();
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = null;
      // A speaking slot is permission, never a request to enable the user's microphone.
      if (
        previous?.speakerId !== message.state.speakerId ||
        previous?.phase !== message.state.phase
      ) {
        this.micWanted = false;
        this.micSlot += 1;
      }
      this.publish({ state: message.state });
      if (message.state.turnEndsAt !== null && message.state.phase === "running") {
        const generation = this.epoch;
        this.turnTimer = setTimeout(
          () => {
            if (generation !== this.epoch) return;
            this.micWanted = false;
            this.micSlot += 1;
            this.syncMedia();
          },
          Math.max(0, message.state.turnEndsAt - message.state.serverNow),
        );
      }
      this.syncMedia();
      this.reconcilePeers(message.state);
    } else if (message.type === "mute") {
      if (message.targetId === this.snapshot.selfId) {
        this.micSlot += 1;
        this.micWanted = false;
        this.syncMedia();
      }
    } else if (message.type === "signal") {
      if (message.fromId === this.snapshot.selfId) return;
      const known = this.snapshot.state?.members.some((member) => member.id === message.fromId);
      if (!known) return;
      const peer = this.ensurePeer(message.fromId);
      if (!peer) return;
      peer.incoming = peer.incoming
        .then(() => this.receiveSignal(message.fromId, peer, message.data))
        .catch(() => {
          if (this.peers.get(message.fromId) === peer) {
            this.peerError(message.fromId, "Не удалось согласовать медиасоединение.");
          }
        });
    } else if (message.type === "error") {
      this.publish({ error: message.message });
    }
  }

  private reconcilePeers(state: RoomState) {
    if (!this.snapshot.selfId) return;
    const ids = new Set(
      state.members
        .filter((member) => member.id !== this.snapshot.selfId)
        .map((member) => member.id),
    );
    for (const id of this.peers.keys()) if (!ids.has(id)) this.removePeer(id);
    for (const id of ids) this.ensurePeer(id);
  }

  private peerError(id: string, message: string) {
    this.publish({
      peerStatus: { ...this.snapshot.peerStatus, [id]: "failed" },
      peerErrors: { ...this.snapshot.peerErrors, [id]: message },
    });
  }

  private removePeer(id: string) {
    const peer = this.peers.get(id);
    if (peer) {
      this.peers.delete(id);
      if (peer.retryTimer) clearTimeout(peer.retryTimer);
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onnegotiationneeded = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    }
    this.snapshot.remoteStreams[id]?.getTracks().forEach((track) => track.stop());
    const remoteStreams = { ...this.snapshot.remoteStreams };
    const peerStatus = { ...this.snapshot.peerStatus };
    const peerErrors = { ...this.snapshot.peerErrors };
    delete remoteStreams[id];
    delete peerStatus[id];
    delete peerErrors[id];
    this.publish({ remoteStreams, peerStatus, peerErrors });
  }

  private ensurePeer(id: string): Peer | null {
    const existing = this.peers.get(id);
    if (existing) return existing;
    if (!this.snapshot.selfId || this.snapshot.status !== "connected") return null;
    if (typeof RTCPeerConnection === "undefined") {
      this.peerError(id, "Этот браузер не поддерживает аудио- и видеозвонки.");
      return null;
    }
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    // Reserve both media sections even when both users join without granting devices.
    const audio = pc.addTransceiver("audio", { direction: "sendrecv" });
    const video = pc.addTransceiver("video", { direction: "sendrecv" });
    const peer: Peer = {
      pc,
      audio,
      video,
      polite: this.snapshot.selfId > id,
      makingOffer: false,
      ignoreOffer: false,
      settingAnswer: false,
      candidates: [],
      incoming: Promise.resolve(),
      retryTimer: null,
      restarted: false,
    };
    this.peers.set(id, peer);
    this.publish({ peerStatus: { ...this.snapshot.peerStatus, [id]: "connecting" } });
    void this.attachTracks(id, peer);
    pc.onicecandidate = (event) => {
      if (this.peers.get(id) !== peer || !event.candidate) return;
      this.send({ type: "signal", targetId: id, data: { candidate: event.candidate.toJSON() } });
    };
    pc.ontrack = (event) => {
      if (this.peers.get(id) !== peer) return;
      const stream = this.snapshot.remoteStreams[id] ?? new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id))
        stream.addTrack(event.track);
      this.publish({ remoteStreams: { ...this.snapshot.remoteStreams, [id]: stream } });
      event.track.onended = () => {
        if (this.peers.get(id) !== peer) return;
        stream.removeTrack(event.track);
        this.publish({ remoteStreams: { ...this.snapshot.remoteStreams, [id]: stream } });
      };
    };
    pc.onnegotiationneeded = async () => {
      if (this.peers.get(id) !== peer || peer.makingOffer) return;
      // One lexical initiator prevents simultaneous first offers from cancelling ICE gathering.
      if (peer.polite && !pc.localDescription) return;
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (this.peers.get(id) === peer && pc.localDescription) {
          this.send({
            type: "signal",
            targetId: id,
            data: { description: pc.localDescription.toJSON() },
          });
        }
      } catch {
        if (this.peers.get(id) === peer && pc.signalingState !== "closed") {
          this.peerError(id, "Не удалось установить медиасоединение.");
        }
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(id) !== peer) return;
      const status: RoomPeerStatus =
        pc.connectionState === "connected"
          ? "connected"
          : pc.connectionState === "failed"
            ? "failed"
            : pc.connectionState === "disconnected"
              ? "disconnected"
              : "connecting";
      this.publish({ peerStatus: { ...this.snapshot.peerStatus, [id]: status } });
      if (pc.connectionState === "connected") {
        if (peer.retryTimer) clearTimeout(peer.retryTimer);
        peer.retryTimer = null;
        peer.restarted = false;
        const errors = { ...this.snapshot.peerErrors };
        delete errors[id];
        this.publish({ peerErrors: errors });
      } else if (pc.connectionState === "failed") {
        this.restartPeer(id, peer);
      } else if (pc.connectionState === "disconnected") {
        if (peer.retryTimer) clearTimeout(peer.retryTimer);
        peer.retryTimer = setTimeout(() => {
          if (this.peers.get(id) === peer && pc.connectionState !== "connected")
            this.restartPeer(id, peer);
        }, 8000);
      }
    };
    peer.retryTimer = setTimeout(() => {
      if (this.peers.get(id) === peer && pc.connectionState !== "connected")
        this.restartPeer(id, peer);
    }, 25000);
    return peer;
  }

  private restartPeer(id: string, peer: Peer) {
    if (this.peers.get(id) !== peer) return;
    if (peer.retryTimer) clearTimeout(peer.retryTimer);
    if (peer.restarted) {
      this.peerError(
        id,
        "Прямое соединение недоступно в этой сети. Для таких сетей нужен TURN-сервер.",
      );
      peer.retryTimer = null;
      return;
    }
    peer.restarted = true;
    peer.pc.restartIce();
    peer.retryTimer = setTimeout(() => {
      if (this.peers.get(id) === peer && peer.pc.connectionState !== "connected") {
        this.peerError(
          id,
          "Не удалось соединиться с участником. В этой сети может требоваться TURN-сервер.",
        );
      }
      peer.retryTimer = null;
    }, 20000);
  }

  private async receiveSignal(
    id: string,
    peer: Peer,
    data: Extract<ClientMessage, { type: "signal" }>["data"],
  ) {
    if (this.peers.get(id) !== peer) return;
    const pc = peer.pc;
    if (data.description) {
      const description = data.description;
      const readyForOffer =
        !peer.makingOffer && (pc.signalingState === "stable" || peer.settingAnswer);
      const collision = description.type === "offer" && !readyForOffer;
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) {
        peer.candidates = [];
        return;
      }
      peer.settingAnswer = description.type === "answer";
      try {
        // Polite peers automatically roll back a simultaneous local offer.
        await pc.setRemoteDescription(description);
      } finally {
        peer.settingAnswer = false;
      }
      if (this.peers.get(id) !== peer) return;
      for (const candidate of peer.candidates.splice(0)) {
        await pc.addIceCandidate(candidate);
      }
      if (description.type === "offer") {
        await pc.setLocalDescription();
        if (this.peers.get(id) === peer && pc.localDescription) {
          this.send({
            type: "signal",
            targetId: id,
            data: { description: pc.localDescription.toJSON() },
          });
        }
      }
    }
    if (data.candidate && !peer.ignoreOffer) {
      if (!pc.remoteDescription) {
        // Signaling can deliver ICE before the asynchronous SDP operation finishes.
        if (peer.candidates.length < 100) peer.candidates.push(data.candidate);
      } else {
        await pc.addIceCandidate(data.candidate);
      }
    }
  }

  private async attachTracks(id: string, peer: Peer) {
    const audio =
      this.stream?.getAudioTracks().find((track) => track.readyState === "live") ?? null;
    const video =
      this.stream?.getVideoTracks().find((track) => track.readyState === "live") ?? null;
    try {
      await Promise.all([
        peer.audio.sender.replaceTrack(audio),
        peer.video.sender.replaceTrack(video),
      ]);
    } catch {
      if (this.peers.get(id) === peer)
        this.peerError(id, "Не удалось передать камеру или микрофон этому участнику.");
    }
  }

  private async acquireMedia(audio: boolean, video: boolean) {
    const generation = this.epoch;
    if (this.mediaRequest) await this.mediaRequest;
    if (generation !== this.epoch) return;
    if (this.snapshot.status !== "connected") {
      this.publish({ mediaError: "Сначала подключитесь к комнате." });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.publish({
        mediaError: "Доступ к устройствам требует HTTPS и браузер с поддержкой видеозвонков.",
      });
      return;
    }
    const needAudio =
      audio && !this.stream?.getAudioTracks().some((track) => track.readyState === "live");
    const needVideo =
      video && !this.stream?.getVideoTracks().some((track) => track.readyState === "live");
    if (!needAudio && !needVideo) return;
    const request = (async () => {
      let captured: MediaStream;
      let partialError: string | null = null;
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24, max: 30 },
      };
      try {
        try {
          captured = await navigator.mediaDevices.getUserMedia({
            audio: needAudio ? audioConstraints : false,
            video: needVideo ? videoConstraints : false,
          });
        } catch (reason) {
          if (!needAudio || !needVideo) throw reason;
          if (generation !== this.epoch) return;
          // A missing camera must not prevent an available microphone, and vice versa.
          try {
            captured = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: false,
            });
            partialError =
              "Камера недоступна. Микрофон подключён; его можно включить в свою очередь.";
          } catch {
            if (generation !== this.epoch) return;
            captured = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: videoConstraints,
            });
            partialError = "Микрофон недоступен. Камера подключена; можно участвовать через чат.";
          }
        }
      } catch (reason) {
        if (generation === this.epoch) this.publish({ mediaError: mediaMessage(reason) });
        return;
      }
      // A permission dialog may finish after leaving the room; never keep those tracks.
      if (generation !== this.epoch) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      for (const track of captured.getTracks()) {
        track.enabled = false;
        track.onended = () => {
          if (generation !== this.epoch) return;
          if (track.kind === "audio") this.micWanted = false;
          if (track.kind === "video") this.cameraWanted = false;
          this.publish({
            mediaError:
              "Устройство отключено. Его можно подключить снова кнопкой камеры или микрофона.",
          });
          this.syncMedia();
          for (const [id, peer] of this.peers) void this.attachTracks(id, peer);
        };
      }
      const existing =
        this.stream?.getTracks().filter((track) => track.readyState === "live") ?? [];
      this.stream = new MediaStream([...existing, ...captured.getTracks()]);
      if (captured.getVideoTracks().length > 0) this.cameraWanted = true;
      // Granting permission never unmutes audio; the user explicitly toggles it next.
      this.publish({ localStream: this.stream, mediaError: partialError });
      this.syncMedia();
      await Promise.all([...this.peers].map(([id, peer]) => this.attachTracks(id, peer)));
    })();
    this.mediaRequest = request;
    try {
      await request;
    } finally {
      if (this.mediaRequest === request) this.mediaRequest = null;
    }
  }

  async enableMedia() {
    await this.acquireMedia(true, true);
  }

  async toggleMic() {
    const generation = this.epoch;
    const slot = this.micSlot;
    if (this.micWanted) {
      this.micWanted = false;
      this.syncMedia();
      return;
    }
    if (!this.canSpeak()) {
      this.publish({
        mediaError: "Микрофон можно включить вручную, когда ведущий передаст вам слово.",
      });
      return;
    }
    await this.acquireMedia(true, false);
    if (generation !== this.epoch || slot !== this.micSlot || !this.canSpeak()) return;
    if (this.stream?.getAudioTracks().some((track) => track.readyState === "live")) {
      this.micWanted = true;
      this.publish({ mediaError: null });
      this.syncMedia();
    }
  }

  async toggleCamera() {
    const generation = this.epoch;
    if (this.cameraWanted) {
      this.cameraWanted = false;
      this.syncMedia();
      return;
    }
    await this.acquireMedia(false, true);
    if (generation !== this.epoch) return;
    if (this.stream?.getVideoTracks().some((track) => track.readyState === "live")) {
      this.cameraWanted = true;
      this.publish({ mediaError: null });
      this.syncMedia();
    }
  }
}

/** Connect does not request device access. Call enableMedia/toggles only from user actions. */
export function useRoom() {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(emptySnapshot);
  const [controller] = useState(() => new RoomController(setSnapshot));
  useEffect(() => () => controller.disconnect(), [controller]);
  const connect = useCallback(
    (roomId: string, name: string) => controller.connect(roomId, name),
    [controller],
  );
  const disconnect = useCallback(() => controller.disconnect(), [controller]);
  const send = useCallback((message: ClientMessage) => controller.send(message), [controller]);
  const enableMedia = useCallback(() => controller.enableMedia(), [controller]);
  const toggleMic = useCallback(() => controller.toggleMic(), [controller]);
  const toggleCamera = useCallback(() => controller.toggleCamera(), [controller]);
  return { ...snapshot, connect, disconnect, send, enableMedia, toggleMic, toggleCamera };
}
