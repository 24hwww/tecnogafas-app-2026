import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface KodularMessage {
  action: string;
  [key: string]: unknown;
}

interface KodularWindow extends Window {
  AppInventor?: {
    setWebViewString: (message: string) => void;
  };
  Capacitor?: {
    isNative?: boolean;
  };
  KodularMessage?: (data: string | KodularMessage) => void;
}

class SystemBridge {
  listeners: Record<string, ((data: KodularMessage) => void)[]>;
  isKodular: boolean;
  isCapacitor: boolean;

  constructor() {
    this.listeners = {};
    const bridgeWindow = typeof window !== 'undefined' ? (window as KodularWindow) : undefined;
    this.isKodular =
      typeof window !== 'undefined' && typeof bridgeWindow?.AppInventor !== 'undefined';
    this.isCapacitor = typeof window !== 'undefined' && bridgeWindow?.Capacitor?.isNative === true;

    this._initGlobalListener();
    if (this.isCapacitor) {
      this._initCapacitorListeners();
    }
  }

  // ─────────────────────────────
  // INIT LISTENER GLOBAL
  // ─────────────────────────────
  _initGlobalListener() {
    if (typeof window === 'undefined') return;

    (window as KodularWindow).KodularMessage = (data: string | KodularMessage) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;

        if (!msg || !msg.action) return;

        const handlers = this.listeners[msg.action] || [];
        handlers.forEach((fn) => fn(msg));
      } catch (err) {
        console.error('[SystemBridge] parse error', err);
      }
    };
  }

  _initCapacitorListeners() {
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
    });
  }

  // ─────────────────────────────
  // ENVIAR A PLATAFORMA (Kodular/Capacitor/Web)
  // ─────────────────────────────
  send(action: string, payload: Record<string, unknown> = {}) {
    const message = JSON.stringify({ action, ...payload });

    if (this.isKodular) {
      try {
        (window as KodularWindow).AppInventor?.setWebViewString(message);
      } catch (e) {
        console.warn('[SystemBridge] fallback appinventor://');
        window.location.href = `appinventor://do?action=${encodeURIComponent(message)}`;
      }
    } else {
      console.log(`[Bridge → ${this.isCapacitor ? 'Capacitor' : 'Web Mock'}]`, message);
    }
  }

  // ─────────────────────────────
  // SUSCRIPCIÓN A EVENTOS
  // ─────────────────────────────
  on(action: string, callback: (data: KodularMessage) => void) {
    if (!this.listeners[action]) {
      this.listeners[action] = [];
    }
    this.listeners[action].push(callback);

    return () => {
      this.listeners[action] = (this.listeners[action] || []).filter((fn) => fn !== callback);
    };
  }

  // ─────────────────────────────
  // HANDSHAKE
  // ─────────────────────────────
  init() {
    this.send('INIT', {
      platform: this.isCapacitor ? 'capacitor' : this.isKodular ? 'kodular' : 'pwa',
      userAgent: navigator.userAgent,
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    });
  }

  // ─────────────────────────────
  // PERMISOS
  // ─────────────────────────────
  requestPermission(permission: string) {
    this.send('REQUEST_PERMISSION', { permission });
  }

  // ─────────────────────────────
  // FEATURES NATIVAS
  // ─────────────────────────────
  async share(text: string) {
    if (this.isCapacitor && navigator.share) {
      try {
        await navigator.share({ text });
      } catch (e) {
        console.error('Error sharing via Web Share API', e);
      }
    } else {
      this.send('SHARE', { text });
    }
  }

  scanQR() {
    this.send('SCAN_QR');
  }

  async vibrate(ms = 200) {
    if (this.isCapacitor) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {
        console.error('Haptics failed', e);
      }
    } else if (navigator.vibrate) {
      navigator.vibrate(ms);
    } else {
      this.send('VIBRATE', { ms });
    }
  }

  notify(title: string, message: string) {
    this.send('NOTIFY', { title, message });
  }

  checkUpdate() {
    this.send('CHECK_UPDATE');
  }

  closeApp() {
    if (this.isCapacitor) {
      App.exitApp();
    } else {
      this.send('CLOSE_APP');
    }
  }
}

export const kodular = new SystemBridge();
