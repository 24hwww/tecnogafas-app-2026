import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-on-surface">Página no encontrada</h2>
        </div>

        <p className="text-on-surface-variant text-lg">
          La página que buscas no existe o ha sido movida.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-variant hover:bg-surface-variant/80 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
            Volver
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Home size={18} />
            Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
