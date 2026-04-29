import { useEffect, useState } from 'react';
import { kodular } from '../lib/kodularBridge';

export function useUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const unsub = kodular.on('UPDATE_AVAILABLE', (data) => {
      setHasUpdate(true);
    });

    return unsub;
  }, []);

  const check = () => {
    kodular.checkUpdate();
  };

  return { hasUpdate, check };
}
