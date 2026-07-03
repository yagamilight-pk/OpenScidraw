import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

const PUBLIC_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export interface WebRTCSession {
  provider: WebrtcProvider;
  roomId: string;
  shareUrl: string;
}

let activeSession: WebRTCSession | null = null;

export function generateRoomId(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return 'sci_' + Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export function buildShareUrl(roomId: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#room=${roomId}`;
}

export function getRoomIdFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/#room=([a-z0-9_]+)/);
  return match ? match[1] : null;
}

export function initWebRTCProvider(ydoc: Y.Doc, roomId: string): WebRTCSession {
  if (activeSession) {
    activeSession.provider.destroy();
    activeSession = null;
  }

  const provider = new WebrtcProvider(roomId, ydoc, {
    signaling: [
      'wss://signaling.yjs.dev',
      'wss://y-webrtc-signaling-eu.herokuapp.com',
      'wss://y-webrtc-signaling-us.herokuapp.com',
    ],
    password: null,
    awareness: undefined,
    maxConns: 20,
    filterBcConns: true,
    peerOpts: {
      config: {
        iceServers: PUBLIC_STUN_SERVERS,
      },
    },
  } as any);

  const shareUrl = buildShareUrl(roomId);
  window.history.replaceState(null, '', `#room=${roomId}`);

  activeSession = { provider, roomId, shareUrl };
  return activeSession;
}

export function destroyWebRTCProvider(): void {
  if (activeSession) {
    activeSession.provider.destroy();
    activeSession = null;
  }
}

export function getActiveSession(): WebRTCSession | null {
  return activeSession;
}

export function getAwareness(): WebrtcProvider['awareness'] | null {
  return activeSession?.provider.awareness ?? null;
}
