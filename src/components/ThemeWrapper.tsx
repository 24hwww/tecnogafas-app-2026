import { type ReactNode, useEffect } from 'react';
import { useUI } from '../contexts/UIContext';

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { primaryColor, fontSize } = useUI();

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    document.documentElement.style.setProperty('font-size', fontSize);
  }, [primaryColor, fontSize]);

  return <>{children}</>;
}
