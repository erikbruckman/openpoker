import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

import { GameState, PlayerAction } from '../../../shared/types';
import type { PublicGameState, PrivateGameState, PlayerData } from '../../../shared/types';
// Re-export for components that were importing them from here
export { GameState, PlayerAction };
export type { PublicGameState, PrivateGameState, PlayerData };

const SOCKET_URL = 'http://localhost:3001';

export function usePokerEngine() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');

  const [playerId, setPlayerId] = useState<string | null>(() => localStorage.getItem('playerId'));

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setHasJoinedRoom(false);
    });

    newSocket.on('roomJoined', ({ playerId: newPlayerId }: { playerId: string }) => {
      setPlayerId(newPlayerId);
      localStorage.setItem('playerId', newPlayerId);
    });

    newSocket.on('gameState', (state: PublicGameState) => {
      setGameState(state);
    });

    newSocket.on('privateState', (state: PrivateGameState) => {
      setPrivateState(state);
    });

    newSocket.on('error', (msg: string) => {
      setError(msg);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = useCallback((playerName: string, code: string) => {
    if (socket) {
      setRoomCode(code);
      socket.emit('joinRoom', { playerName, roomCode: code, playerId });
      setHasJoinedRoom(true);
    }
  }, [socket, playerId]);

  const startHand = useCallback(() => {
    if (socket && roomCode) {
      socket.emit('startHand', { roomCode });
    }
  }, [socket, roomCode]);

  const takeAction = useCallback((action: 'fold' | 'call' | 'raise', amount?: number) => {
    if (socket && roomCode) {
      socket.emit('playerAction', { roomCode, action, amount });
    }
  }, [socket, roomCode]);

  return {
    isConnected,
    hasJoinedRoom,
    gameState,
    privateState,
    error,
    playerId,
    joinRoom,
    startHand,
    takeAction,
  };
}
