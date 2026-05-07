import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getPrimaryColor, savePrimaryColor } from '../stores/appDatabase';

interface UIContextType {
  theme: 'light' | 'dark';
  primaryColor: string;
  fontSize: string;
  setTheme: (theme: 'light' | 'dark', isManual?: boolean) => void;
  setPrimaryColor: (color: string) => void;
  setFontSize: (size: string) => void;
  resetThemeToAuto: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState('#0A5DFF');
  const [fontSize, setFontSize] = useState('16px');
  
  // Initialize theme synchronously to prevent flash
  const getInitialTheme = (): 'light' | 'dark' => {
    const savedTheme = localStorage.getItem('tecnogafas_theme') as 'light' | 'dark' | null;
    const isManual = localStorage.getItem('tecnogafas_theme_manual') === 'true';
    
    if (savedTheme && isManual) {
      return savedTheme;
    }
    
    // Auto-detect theme based on Buenos Aires time
    const now = new Date();
    const buenosAiresTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }),
    );
    const hour = buenosAiresTime.getHours();
    return hour >= 6 && hour < 18 ? 'light' : 'dark';
  };
  
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme());
  
  // Apply initial theme immediately to prevent flash
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }

  const updatePrimaryColor = async (color: string) => {
    setPrimaryColor(color);
    await savePrimaryColor(color);
    // Update CSS custom properties for dynamic theming
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--primary-color-hover', color + 'dd');
    document.documentElement.style.setProperty('--primary-color-active', color + 'bb');
  };

  const updateFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('tecnogafas_fontSize', size);
  };

  const detectBuenosAiresTheme = useCallback(() => {
    const now = new Date();
    const buenosAiresTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }),
    );
    const hour = buenosAiresTime.getHours();
    return hour >= 6 && hour < 18 ? 'light' : 'dark';
  }, []);

  const updateTheme = useCallback((newTheme: 'light' | 'dark', isManual = true) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('tecnogafas_theme', newTheme);
    if (isManual) {
      localStorage.setItem('tecnogafas_theme_manual', 'true');
    }
  }, []);

  const resetThemeToAuto = useCallback(() => {
    localStorage.removeItem('tecnogafas_theme_manual');
    const autoTheme = detectBuenosAiresTheme();
    setTheme(autoTheme);
    document.documentElement.setAttribute('data-theme', autoTheme);
  }, [detectBuenosAiresTheme]);

  useEffect(() => {
    // Load primary color from Dexie
    getPrimaryColor().then(color => {
      setPrimaryColor(color);
      // Apply CSS custom properties for initial color
      document.documentElement.style.setProperty('--primary-color', color);
      document.documentElement.style.setProperty('--primary-color-hover', color + 'dd');
      document.documentElement.style.setProperty('--primary-color-active', color + 'bb');
    });
    
    const savedFontSize = localStorage.getItem('tecnogafas_fontSize');
    if (savedFontSize) setFontSize(savedFontSize);

    const savedTheme = localStorage.getItem('tecnogafas_theme') as 'light' | 'dark' | null;
    const isManual = localStorage.getItem('tecnogafas_theme_manual') === 'true';

    if (savedTheme && isManual) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (savedTheme && !isManual) {
      const autoTheme = detectBuenosAiresTheme();
      setTheme(autoTheme);
      document.documentElement.setAttribute('data-theme', autoTheme);
      localStorage.setItem('tecnogafas_theme', autoTheme);
    } else {
      const autoTheme = detectBuenosAiresTheme();
      setTheme(autoTheme);
      document.documentElement.setAttribute('data-theme', autoTheme);
      localStorage.setItem('tecnogafas_theme', autoTheme);
    }
  }, [detectBuenosAiresTheme]);

  useEffect(() => {
    const isManual = localStorage.getItem('tecnogafas_theme_manual') === 'true';
    if (isManual) return;

    const checkTheme = () => {
      const autoTheme = detectBuenosAiresTheme();
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      if (autoTheme !== currentTheme) {
        setTheme(autoTheme);
        document.documentElement.setAttribute('data-theme', autoTheme);
        localStorage.setItem('tecnogafas_theme', autoTheme);
      }
    };

    checkTheme();
    const interval = setInterval(checkTheme, 60000);
    return () => clearInterval(interval);
  }, [detectBuenosAiresTheme]);

  return (
    <UIContext.Provider
      value={{
        theme,
        primaryColor,
        fontSize,
        setTheme: updateTheme,
        setPrimaryColor: updatePrimaryColor,
        setFontSize: updateFontSize,
        resetThemeToAuto,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
}
