export interface KodularMessage {
  action: string;
  [key: string]: any;
}

class KodularBridge {
  listeners: Record<string, ((data: KodularMessage) => void)[]>;
  isKodular: boolean;

  constructor() {
    this.listeners = {};
    this.isKodular = typeof window !== 'undefined' &&
                     typeof (window as any).AppInventor !== 'undefined';

    this._initGlobalListener();
  }

  // ─────────────────────────────
  // INIT LISTENER GLOBAL
  // ─────────────────────────────
  _initGlobalListener() {
    if (typeof window === 'undefined') return;

    (window as any).KodularMessage = (data: string | KodularMessage) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;

        if (!msg || !msg.action) return;

        const handlers = this.listeners[msg.action] || [];
        handlers.forEach(fn => fn(msg));

      } catch (err) {
        console.error('[KodularBridge] parse error', err);
      }
    };
  }

  // ─────────────────────────────
  // ENVIAR A KODULAR
  // ─────────────────────────────
  send(action: string, payload: Record<string, any> = {}) {
    const message = JSON.stringify({ action, ...payload });

    if (this.isKodular) {
      try {
        (window as any).AppInventor.setWebViewString(message);
      } catch (e) {
        console.warn('[KodularBridge] fallback appinventor://');
        window.location.href =
          `appinventor://do?action=${encodeURIComponent(message)}`;
      }
    } else {
      console.log('[Bridge → Kodular MOCK]', message);
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
      this.listeners[action] =
        this.listeners[action].filter(fn => fn !== callback);
    };
  }

  // ─────────────────────────────
  // HANDSHAKE
  // ─────────────────────────────
  init() {
    this.send('INIT', {
      platform: 'pwa',
      userAgent: navigator.userAgent,
      version: import.meta.env.VITE_APP_VERSION || '1.0.0'
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
  share(text: string) {
    this.send('SHARE', { text });
  }

  scanQR() {
    this.send('SCAN_QR');
  }

  vibrate(ms = 200) {
    this.send('VIBRATE', { ms });
  }

  notify(title: string, message: string) {
    this.send('NOTIFY', { title, message });
  }

  checkUpdate() {
    this.send('CHECK_UPDATE');
  }

  closeApp() {
    this.send('CLOSE_APP');
  }
}

export const kodular = new KodularBridge();
