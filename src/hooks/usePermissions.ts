import { useEffect, useState } from 'react';
import { kodular } from '../lib/kodularBridge';

export function usePermissions() {
  const [permissions, setPermissions] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = kodular.on('PERMISSION_RESULT', ({ permission, status }) => {
      if (typeof permission !== 'string') return;
      setPermissions((prev) => ({
        ...prev,
        [permission]: typeof status === 'string' ? status : String(status ?? ''),
      }));
    });

    return unsub;
  }, []);

  const request = (permission: string) => {
    kodular.requestPermission(permission);
  };

  return { permissions, request };
}
