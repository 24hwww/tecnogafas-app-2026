import { useApp } from '../AppContext';
import { useEffect, ReactNode } from 'react';

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { primaryColor, fontSize } = useApp();

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    document.documentElement.style.setProperty('font-size', fontSize);
  }, [primaryColor, fontSize]);

  return <>{children}</>;
}
