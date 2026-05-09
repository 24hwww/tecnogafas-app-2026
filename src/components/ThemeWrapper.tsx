import { type ReactNode, useEffect } from 'react';
import { useUI } from '../contexts/UIContext';

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { theme, fontSize } = useUI();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('font-size', fontSize);

    // Update meta theme-color for mobile browser chrome
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0A0F1E' : '#059669');
    }
  }, [theme, fontSize]);

  return <>{children}</>;
}
