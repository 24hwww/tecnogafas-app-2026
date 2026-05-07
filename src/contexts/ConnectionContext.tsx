import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

interface ConnectionContextType {
  isOnline: boolean;
  connectionStatus: 'online' | 'offline' | 'syncing' | 'error';
  onlineUsersCount: number | null;
  setConnectionStatus: (status: 'online' | 'offline' | 'syncing' | 'error') => void;
  setOnlineUsersCount: (count: number | null) => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionStatus, setConnectionStatus] = useState<
    'online' | 'offline' | 'syncing' | 'error'
  >('online');
  const [onlineUsersCount, setOnlineUsersCount] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ConnectionContext.Provider
      value={{
        isOnline,
        connectionStatus,
        onlineUsersCount,
        setConnectionStatus,
        setOnlineUsersCount,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('useConnection must be used within ConnectionProvider');
  return context;
}
