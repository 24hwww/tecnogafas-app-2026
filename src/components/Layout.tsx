import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { House, Package, Users, ClipboardList, ShoppingCart, Menu, X, Bell, Settings, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../AppContext';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { path: '/', label: 'Inicio', icon: House },
  { path: '/productos', label: 'Productos', icon: Package },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { path: '/carrito', label: 'Carrito', icon: ShoppingCart },
  { path: '/notificaciones', label: 'Notificaciones', icon: Bell },
  { path: '/configuracion', label: 'Configuración', icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const { cart, unreadNotifications, isLoading, apiError, onlineUsersCount } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const isHome = location.pathname === '/';

  const [versions, setVersions] = useState({ app: 'Cargando...', api: 'Cargando...' });

  useEffect(() => {
    const handlePopState = () => {
      console.log('Navigation: PopState triggered (Back Button)');
    };
    window.addEventListener('popstate', handlePopState);

    const fetchVersions = async () => {
      let apiVersion = '1.0.0';
      let appVersion = '1.0.0';

      // GitHub Commits
      try {
        const repoNames = ['tecnogafas-ventas-pwa', 'tecnogafas-pwa', 'tecno-app'];
        for (const repo of repoNames) {
           const res = await fetch(`https://api.github.com/repos/24hwww/${repo}/commits?per_page=1`);
           if (res.ok) {
              const linkHeader = res.headers.get('link');
              if (linkHeader) {
                 const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
                 if (match) {
                    appVersion = `1.2.${match[1]}`;
                    break;
                 }
              }
           }
        }
      } catch (e) {}

      // Swagger API Version
      try {
        const urls = [
          'https://api.tecnogafas.com.ar/swagger.json',
          'https://api.tecnogafas.com.ar/docs/swagger.json',
          'https://api.tecnogafas.com.ar/api/swagger'
        ];
        for (const url of urls) {
           const res = await fetch(url);
           if (res.ok) {
             const data = await res.json();
             if (data?.info?.version) {
                 apiVersion = data.info.version;
                 break;
             }
           }
        }
      } catch (e) {}

      setVersions({ app: `v${appVersion}`, api: `v${apiVersion}` });
    };

    fetchVersions();

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="flex h-screen max-w-md mx-auto bg-surface overflow-hidden shadow-2xl relative text-on-surface">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-surface/80 z-[100] flex flex-col items-center justify-center backdrop-blur-sm"
          >
            <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-sm font-bold text-primary animate-pulse tracking-widest uppercase">Sincronizando...</p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 bg-surface-variant text-on-surface-variant z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary flex items-center justify-center text-on-primary font-bold text-lg">T</div>
                  <span className="font-bold tracking-tight text-on-surface">Tecnogafas</span>
                </div>
                <button onClick={closeSidebar} className="p-1 hover:bg-white/10">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center space-x-3 p-3 text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-primary-container text-on-primary-container shadow-inner" 
                          : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                      )
                    }
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    {item.label === 'Carrito' && cart.length > 0 && (
                      <span className="ml-auto bg-primary text-on-primary text-[0.625rem] px-1.5 py-0.5 font-bold">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                    {item.label === 'Notificaciones' && unreadNotifications > 0 && (
                      <span className="ml-auto bg-error text-white text-[0.625rem] px-1.5 py-0.5 font-bold rounded-full">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="p-4 border-t border-white/5">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">V</div>
                  <div className="text-xs">
                    <p className="font-semibold text-on-surface">Vendedor</p>
                    <p className="text-outline">App {versions.app} • API {versions.api}</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="p-4 flex items-center justify-between bg-surface sticky top-0 z-30 border-b border-surface-variant/50">
          <div className="flex items-center gap-2">
            <h1 
              onClick={() => navigate('/')} 
              className="text-xl font-bold text-primary tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
            >
              Tecnogafas
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {onlineUsersCount !== null && (
              <div title="Vendedores activos" className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-700 font-bold text-[0.625rem] rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span>{onlineUsersCount}</span>
              </div>
            )}
            <button 
              onClick={() => navigate('/carrito')}
              className="relative p-2 hover:bg-surface-variant text-on-surface-variant transition-colors"
            >
              <ShoppingCart size={24} />
              {cart.reduce((a, b) => a + b.quantity, 0) > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-on-primary text-[0.625rem] w-4 h-4 flex items-center justify-center font-bold">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
            <button onClick={toggleSidebar} className="p-2 hover:bg-surface-variant text-on-surface-variant transition-colors">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {apiError && (
          <div className="bg-red-500 text-white text-xs font-bold p-2 text-center shadow flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin-slow" />
            {apiError}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-surface">
          <div key={location.pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
