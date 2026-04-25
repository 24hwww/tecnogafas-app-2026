import { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ClipboardList, ShoppingCart, Menu, X, Bell, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../AppContext';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/productos', label: 'Productos', icon: Package },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { path: '/carrito', label: 'Carrito', icon: ShoppingCart },
  { path: '/notificaciones', label: 'Notificaciones', icon: Bell },
  { path: '/configuracion', label: 'Configuración', icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const { cart, isLoading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

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
            <div className="w-12 h-12 border-4 border-primary border-t-transparent animate-spin mb-4" />
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
                      <span className="ml-auto bg-primary text-on-primary text-[10px] px-1.5 py-0.5 font-bold">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="p-4 border-t border-white/5">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">JD</div>
                  <div className="text-xs">
                    <p className="font-semibold text-on-surface">Vendedor</p>
                    <p className="text-outline">Admin • v1.4.2</p>
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
          <div className="flex items-center gap-3">
            <h1 
              onClick={() => navigate('/')} 
              className="text-xl font-bold text-primary tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
            >
              Tecnogafas
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/carrito')}
              className="relative p-2 hover:bg-surface-variant text-on-surface-variant transition-colors"
            >
              <ShoppingCart size={24} />
              {cart.reduce((a, b) => a + b.quantity, 0) > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-on-primary text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
            <button onClick={toggleSidebar} className="p-2 hover:bg-surface-variant text-on-surface-variant transition-colors">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-surface">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
