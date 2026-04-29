import { useEffect, useState } from 'react';
import { kodular } from '../lib/kodularBridge';

export function usePermissions() {
  const [permissions, setPermissions] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = kodular.on('PERMISSION_RESULT', ({ permission, status }) => {
      setPermissions(prev => ({
        ...prev,
        [permission]: status as string
      }));
    });

    return unsub;
  }, []);

  const request = (permission: string) => {
    kodular.requestPermission(permission);
  };

  return { permissions, request };
}
