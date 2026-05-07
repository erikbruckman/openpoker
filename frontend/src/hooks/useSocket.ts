import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export function useSocket(url: string): { socket: Socket; status: ConnectionStatus } {
  // useState ensures the socket is created exactly once and stable across re-renders.
  // autoConnect:false so we manage connection lifecycle explicitly in the effect below.
  const [socket] = useState<Socket>(() => io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  }));
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onReconnectAttempt = () => setStatus('reconnecting');
    const onReconnectFailed = () => setStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect_failed', onReconnectFailed);

    // Show error state if the server is unreachable after 10 seconds
    const connectTimeout = setTimeout(() => {
      if (!socket.connected) setStatus('disconnected');
    }, 10_000);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
      clearTimeout(connectTimeout);
      socket.disconnect();
    };
  }, [socket]);

  return { socket, status };
}
