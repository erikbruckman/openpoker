import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { PublicGameState, PrivateGameState } from '../../../shared/types';

export function useGameState(socket: Socket): {
  publicState: PublicGameState | null;
  privateState: PrivateGameState | null;
  error: string | null;
} {
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onGameState = (state: PublicGameState) => setPublicState(state);
    const onPrivateState = (state: PrivateGameState) => setPrivateState(state);
    const onError = (msg: string) => {
      setError(msg);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setError(null), 4000);
    };

    socket.on('gameState', onGameState);
    socket.on('privateState', onPrivateState);
    socket.on('error', onError);

    return () => {
      socket.off('gameState', onGameState);
      socket.off('privateState', onPrivateState);
      socket.off('error', onError);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [socket]);

  return { publicState, privateState, error };
}
