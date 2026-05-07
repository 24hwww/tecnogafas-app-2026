import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    localStorage.clear();
    try {
      indexedDB.deleteDatabase('tecnogafas-sync');
    } catch {
      // Ignore errors
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-800)] p-6 border border-white/10 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error/20 flex items-center justify-center">
                <span className="text-error text-xl">!</span>
              </div>
              <h2 className="text-lg font-bold text-base-content">Algo salió mal</h2>
            </div>

            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              La aplicación encontró un error inesperado. Puedes intentar recargar la página o
              limpiar la caché.
            </p>

            {this.state.error && (
              <details className="mb-4 text-xs">
                <summary className="text-[var(--color-text-muted)] cursor-pointer hover:text-base-content">
                  Ver detalles técnicos
                </summary>
                <pre className="mt-2 p-2 bg-black/30 text-red-400 overflow-auto max-h-40 font-mono">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-primary text-primary-content py-3 font-bold text-sm hover:brightness-110 transition-all"
              >
                Recargar página
              </button>
              <button
                type="button"
                onClick={this.handleClearCache}
                className="flex-1 bg-base-100 border border-[var(--color-border)] text-base-content py-3 font-bold text-sm hover:bg-[var(--color-surface-800)] transition-all"
              >
                Limpiar caché
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
