import { useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { PlayerAction } from '../../../shared/types';

export function useGameActions(
  socket: Socket,
  roomCode: string,
  playerId: string | null,
  onJoined: (playerId: string) => void
): {
  joinRoom: (playerName: string, code: string) => void;
  startHand: () => void;
  takeAction: (action: PlayerAction, amount?: number) => void;
} {
  useEffect(() => {
    const onRoomJoined = ({ playerId: newId }: { playerId: string }) => {
      localStorage.setItem('playerId', newId);
      onJoined(newId);
    };
    socket.on('roomJoined', onRoomJoined);
    return () => { socket.off('roomJoined', onRoomJoined); };
  }, [socket, onJoined]);

  const joinRoom = useCallback((playerName: string, code: string) => {
    socket.emit('joinRoom', { playerName, roomCode: code, playerId });
  }, [socket, playerId]);

  const startHand = useCallback(() => {
    if (roomCode) socket.emit('startHand', { roomCode });
  }, [socket, roomCode]);

  const takeAction = useCallback((action: PlayerAction, amount?: number) => {
    if (roomCode) socket.emit('playerAction', { roomCode, action, amount });
  }, [socket, roomCode]);

  return { joinRoom, startHand, takeAction };
}
