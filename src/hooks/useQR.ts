import { useEffect, useState } from 'react';
import { kodular } from '../lib/kodularBridge';

export function useQR() {
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const unsub = kodular.on('QR_RESULT', ({ value }) => {
      setResult(value as string);
    });

    return unsub;
  }, []);

  const scan = () => {
    kodular.scanQR();
  };

  return { scan, result };
}
