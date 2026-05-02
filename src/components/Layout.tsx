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
  const [showNotificationBullet, setShowNotificationBullet] = useState(false);

  // Trigger temporary bullet for 1 second when unreadNotifications changes
  useEffect(() => {
    if (unreadNotifications > 0) {
      setShowNotificationBullet(true);
      const timer = setTimeout(() => setShowNotificationBullet(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [unreadNotifications]);

  // Reset bullet when entering notifications page
  useEffect(() => {
    if (location.pathname === '/notificaciones') {
      setShowNotificationBullet(false);
    }
  }, [location.pathname]);

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
      // Valor por defecto en caso de no poder consultar GitHub
      setVersions({ app: `v1.2.0`, api: `v1.0.0` });
    };

    fetchVersions();

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="flex h-screen max-w-md mx-auto bg-background overflow-hidden shadow-2xl relative text-on-surface">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-surface/80 z-[100] flex flex-col items-center justify-center backdrop-blur-md"
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
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-72 bg-surface text-on-surface z-50 flex flex-col shadow-2xl border-r border-outline/10"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary font-bold text-xl shadow-lg shadow-primary/20">T</div>
                  <span className="text-xl font-bold tracking-tight text-on-surface">Tecnogafas</span>
                </div>
                <button onClick={closeSidebar} className="p-2 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 px-3 py-2 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive 
                          ? "bg-primary-container text-on-primary-container font-semibold" 
                          : "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
                      )
                    }
                  >
                    <item.icon size={20} className={cn("transition-colors", location.pathname === item.path ? "text-primary" : "text-on-surface-variant")} />
                    <span>{item.label}</span>
                    {item.label === 'Carrito' && cart.length > 0 && (
                      <span className="ml-auto bg-primary text-on-primary text-[0.7rem] px-2 py-0.5 font-bold rounded-full">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                    {item.label === 'Notificaciones' && unreadNotifications > 0 && (
                      <span className="ml-auto bg-error text-white text-[0.7rem] px-2 py-0.5 font-bold rounded-full">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="p-6 border-t border-outline/10">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center text-sm font-bold">
                    <Users size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">Sesión de Vendedor</p>
                    <p className="text-[0.7rem] text-on-surface-variant font-medium">App {versions.app} • API {versions.api}</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-4 py-3 flex items-center justify-between bg-surface/80 backdrop-blur-md sticky top-0 z-30 border-b border-outline/5">
          <div className="flex items-center gap-2">
            <h1 
              onClick={() => navigate('/')} 
              className="text-xl font-black text-primary tracking-tighter cursor-pointer hover:opacity-80 transition-opacity"
            >
              TECNOGAFAS
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {onlineUsersCount !== null && (
              <div title="Vendedores activos" className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success font-bold text-[0.65rem] rounded-full mr-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                <span>{onlineUsersCount}</span>
              </div>
            )}
            <button 
              onClick={() => navigate('/carrito')}
              className="relative p-2.5 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
            >
              <ShoppingCart size={22} />
              {cart.reduce((a, b) => a + b.quantity, 0) > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-on-primary text-[0.65rem] w-5 h-5 flex items-center justify-center font-bold rounded-full border-2 border-surface">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
            <button 
              id="toolbar-notifications-btn"
              onClick={() => navigate('/notificaciones')}
              className="relative p-2.5 hover:bg-surface-variant rounded-full text-on-surface-variant transition-all active:scale-95"
            >
              <Bell size={22} className={showNotificationBullet ? 'text-primary scale-110' : ''} />
              {showNotificationBullet && (
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-error rounded-full border-2 border-surface animate-pulse" />
              )}
            </button>
            <button onClick={toggleSidebar} className="p-2.5 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors">
              <Menu size={22} />
            </button>
          </div>
        </header>

        {apiError && (
          <div className="bg-error text-white text-[0.7rem] font-bold py-2 px-4 text-center shadow-lg flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            {apiError}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 min-h-full" key={location.pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>

  );
}
