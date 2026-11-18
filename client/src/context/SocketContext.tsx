/**
 * سياق يوفّر اتصال Socket المفرد + حالة الاتصال وعدد المتصلين لكل التطبيق.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';

interface SocketContextValue {
  socket: Socket;
  connected: boolean;
  onlineCount: number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socket = useMemo(() => getSocket(), []);
  const [connected, setConnected] = useState(socket.connected);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onOnlineCount = (data: { count: number }) =>
      setOnlineCount(data?.count ?? 0);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('online_count', onOnlineCount);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('online_count', onOnlineCount);
    };
  }, [socket]);

  const value = useMemo(
    () => ({ socket, connected, onlineCount }),
    [socket, connected, onlineCount],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket يجب أن يُستخدم داخل SocketProvider');
  return ctx;
}
