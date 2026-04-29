import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { kodular } from '../lib/kodularBridge';

export function useAndroidBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = kodular.on('BACK_PRESSED', () => {
      if (location.pathname !== '/') {
        navigate(-1);
      } else {
        const confirmExit = window.confirm('¿Salir de la app?');
        if (confirmExit) {
          kodular.closeApp();
        }
      }
    });

    return unsub;
  }, [location, navigate]);
}
