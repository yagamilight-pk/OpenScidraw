import { useEffect, useRef, useState, useCallback } from 'react';
import type { Awareness } from 'y-protocols/awareness';

export interface RemoteCursor {
  clientId: number;
  name: string;
  color: string;
  x: number;
  y: number;
  zoom: number;
}

export interface LocalPresence {
  name: string;
  color: string;
  x: number;
  y: number;
  zoom: number;
}

const TICK_RATE_MS = 33; // ~30 ticks/sec

export function useMultiplayerCursors(
  awareness: Awareness | null,
  localPresence: LocalPresence
): RemoteCursor[] {
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef(localPresence);
  presenceRef.current = localPresence;

  useEffect(() => {
    if (!awareness) return;

    const handleChange = () => {
      const states = Array.from(awareness.getStates().entries());
      const cursors: RemoteCursor[] = [];
      for (const [clientId, state] of states) {
        if (clientId === awareness.clientID) continue;
        if (!state.cursor) continue;
        cursors.push({
          clientId,
          name: state.cursor.name || `Peer-${clientId}`,
          color: state.cursor.color || '#3b82f6',
          x: state.cursor.x ?? 0,
          y: state.cursor.y ?? 0,
          zoom: state.cursor.zoom ?? 1,
        });
      }
      setRemoteCursors(cursors);
    };

    awareness.on('change', handleChange);

    awareness.setLocalStateField('cursor', {
      name: presenceRef.current.name,
      color: presenceRef.current.color,
      x: presenceRef.current.x,
      y: presenceRef.current.y,
      zoom: presenceRef.current.zoom,
    });

    tickRef.current = setInterval(() => {
      const p = presenceRef.current;
      awareness.setLocalStateField('cursor', {
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        zoom: p.zoom,
      });
    }, TICK_RATE_MS);

    return () => {
      awareness.off('change', handleChange);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [awareness]);

  return remoteCursors;
}

export function useAwarenessEngine(awareness: Awareness | null) {
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [localColor] = useState<string>(() => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 80%, 60%)`;
  });
  const [localName] = useState<string>(() => {
    const adjectives = ['Cyan', 'Violet', 'Amber', 'Teal', 'Rose', 'Indigo', 'Lime'];
    const nouns = ['Nucleus', 'Synapse', 'Ligand', 'Ribosome', 'Axon', 'Mitogen', 'Helix'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
  });

  useEffect(() => {
    if (!awareness) return;

    const handler = () => {
      const count = awareness.getStates().size - 1;
      setConnectedPeers(Math.max(0, count));
    };

    awareness.on('change', handler);
    return () => awareness.off('change', handler);
  }, [awareness]);

  const broadcastViewport = useCallback((zoom: number, offsetX: number, offsetY: number) => {
    if (!awareness) return;
    awareness.setLocalStateField('viewport', { zoom, offsetX, offsetY });
  }, [awareness]);

  return { connectedPeers, localColor, localName, broadcastViewport };
}
