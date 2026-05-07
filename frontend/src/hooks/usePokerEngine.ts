import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';
import type { ConnectionStatus } from './useSocket';
import { useGameState } from './useGameState';
import { useGameActions } from './useGameActions';

export type { ConnectionStatus };

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getInitialRoomCode(): string {
  return new URLSearchParams(window.location.search).get('room') ?? '';
}

function getInitialHasJoined(): boolean {
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  return !!(urlRoom && localStorage.getItem('playerName') && localStorage.getItem('playerId'));
}

export function usePokerEngine() {
  const [playerId, setPlayerId] = useState<string | null>(() => localStorage.getItem('playerId'));
  // Initialize roomCode and hasJoinedRoom eagerly from URL/localStorage so we never
  // need to call setState inside an effect.
  const [roomCode, setRoomCode] = useState<string>(getInitialRoomCode);
  const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(getInitialHasJoined);

  // Refs let async socket handlers always see current state without stale closures.
  // Writes only happen in effects (not during render), satisfying react-hooks/refs.
  const hasJoinedRoomRef = useRef(false);
  const roomCodeRef = useRef('');
  const playerNameRef = useRef<string>(localStorage.getItem('playerName') ?? '');
  const playerIdRef = useRef<string | null>(null);
  // Tracks whether the initial connect has fired so the connect handler only
  // re-emits joinRoom on genuine reconnects, not the initial connection.
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    hasJoinedRoomRef.current = hasJoinedRoom;
    roomCodeRef.current = roomCode;
    playerIdRef.current = playerId;
  });

  const { socket, status } = useSocket(SOCKET_URL);
  const { publicState, privateState, error } = useGameState(socket);

  const handleJoined = useCallback((newPlayerId: string) => {
    setPlayerId(newPlayerId);
  }, []);

  const { joinRoom: emitJoinRoom, startHand, takeAction } = useGameActions(
    socket, roomCode, playerId, handleJoined
  );

  // If URL + localStorage credentials exist, emit joinRoom on mount.
  // socket.io buffers the emit until the connection is established.
  useEffect(() => {
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    const storedName = localStorage.getItem('playerName');
    const storedId = localStorage.getItem('playerId');
    if (urlRoom && storedName && storedId) {
      playerNameRef.current = storedName;
      socket.emit('joinRoom', { playerName: storedName, roomCode: urlRoom, playerId: storedId });
    }
  }, [socket]);

  // Re-emit joinRoom on reconnect (skip the initial connect — auto-join or manual join handles it).
  useEffect(() => {
    const handleConnect = () => {
      if (!hasConnectedRef.current) {
        hasConnectedRef.current = true;
        return;
      }
      if (hasJoinedRoomRef.current && roomCodeRef.current) {
        socket.emit('joinRoom', {
          playerName: playerNameRef.current,
          roomCode: roomCodeRef.current,
          playerId: playerIdRef.current,
        });
      }
    };
    socket.on('connect', handleConnect);
    return () => { socket.off('connect', handleConnect); };
  }, [socket]);

  const joinRoom = useCallback((playerName: string, code: string) => {
    playerNameRef.current = playerName;
    localStorage.setItem('playerName', playerName);
    setRoomCode(code);
    emitJoinRoom(playerName, code);
    setHasJoinedRoom(true);
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url.toString());
  }, [emitJoinRoom]);

  const reconnect = useCallback(() => {
    socket.connect();
  }, [socket]);

  return {
    status,
    hasJoinedRoom,
    gameState: publicState,
    privateState,
    error,
    playerId,
    joinRoom,
    startHand,
    takeAction,
    reconnect,
  };
}
