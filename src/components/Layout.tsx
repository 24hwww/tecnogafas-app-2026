import {
  ClipboardList,
  House,
  Menu,
  MessageCircle,
  Package,
  RefreshCw,
  ScanLine,
  Settings,
  ShoppingCart,
  Users,
  X,
  WifiOff,
  AlertCircle,
  Users2,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useCart } from '../contexts/CartContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import { cn, getAnimationProps } from '../lib/utils';
import { OptimizedPageTransition } from './OptimizedPageTransition';

const navItems = [
  { path: '/', label: 'Inicio', icon: House },
  { path: '/productos', label: 'Productos', icon: Package },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { path: '/carrito', label: 'Carrito', icon: ShoppingCart },
  { path: '/qr-scan', label: 'Escanear QR', icon: ScanLine },
  { path: '/chat', label: 'Chat', icon: MessageCircle },
  { path: '/configuracion', label: 'Configuración', icon: Settings },
];

const DESKTOP_BP = 1024;

function useIsDesktop() {
  const [is, setIs] = useState(typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BP : false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BP}px)`);
    const h = (e: MediaQueryListEvent) => setIs(e.matches);
    mql.addEventListener('change', h);
    setIs(mql.matches);
    return () => mql.removeEventListener('change', h);
  }, []);
  return is;
}

/* ── Sidebar Nav (shared) ── */
function SidebarNav({ closeSidebar, cartCount, unread, pathname, versions }: {
  closeSidebar: () => void;
  cartCount: number;
  unread: number;
  pathname: string;
  versions: { app: string; api: string };
}) {
  return (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-content font-bold text-base">
            T
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-base-content">Tecnogafas</span>
            <p className="text-[10px] text-[var(--color-text-muted)]">Pedidos</p>
          </div>
        </div>
        <button type="button" onClick={closeSidebar} className="btn btn-ghost btn-square btn-xs lg:hidden">
          <X size={16} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group',
                active
                  ? 'bg-[var(--color-surface-800)] text-primary'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-800)] hover:text-base-content',
              )}
            >
              {/* Left emerald accent bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <item.icon size={18} className={cn('shrink-0', active ? 'text-primary' : 'text-[var(--color-text-muted)] group-hover:text-base-content')} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.label === 'Carrito' && cartCount > 0 && (
                <span className="badge badge-sm badge-primary">{cartCount}</span>
              )}
              {item.label === 'Chat' && unread > 0 && pathname !== '/chat' && (
                <span className="badge badge-sm badge-error animate-pulse">{unread > 99 ? '99+' : unread}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs font-bold">JP</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">Sesión de Vendedor</p>
            <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              En línea
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { cart } = useCart();
  const { unreadNotifications } = useNotificationsContext();
  const { isLoading, apiError } = useApp();
  const { onlineUsersCount, connectionStatus } = useConnection();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const [versions] = useState({ app: 'v1.2.0', api: 'v1.0.0' });

  useEffect(() => { closeDrawer(); }, [location.pathname, closeDrawer]);

  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="flex h-dvh bg-base-100 overflow-hidden relative">
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div {...getAnimationProps('fade')} className="absolute inset-0 bg-base-100/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-xs font-semibold text-primary animate-pulse tracking-widest uppercase">Sincronizando...</p>
            <progress className="progress progress-primary w-28 mt-3 h-1" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ DESKTOP SIDEBAR ═══ */}
      {isDesktop && (
        <aside className="hidden lg:flex flex-col w-[var(--sidebar-width)] bg-[var(--color-surface-900)] border-r border-[var(--color-border)] shrink-0">
          <SidebarNav closeSidebar={() => {}} cartCount={cartCount} unread={unreadNotifications} pathname={location.pathname} versions={versions} />
        </aside>
      )}

      {/* ═══ MOBILE DRAWER ═══ */}
      <AnimatePresence>
        {!isDesktop && drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={closeDrawer} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed left-0 top-0 h-full w-[var(--sidebar-width)] bg-[var(--color-surface-900)] z-50 flex flex-col shadow-2xl border-r border-[var(--color-border)]"
            >
              <SidebarNav closeSidebar={closeDrawer} cartCount={cartCount} unread={unreadNotifications} pathname={location.pathname} versions={versions} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-2 px-4 h-14 bg-[var(--color-surface-900)]/80 backdrop-blur-lg sticky top-0 z-30 border-b border-[var(--color-border)] shrink-0">
          <button type="button" onClick={() => setDrawerOpen(true)} className="btn btn-ghost btn-square btn-sm lg:hidden">
            <Menu size={18} />
          </button>

          {/* Search bar (desktop) */}
          <div className="hidden lg:flex flex-1 max-w-md relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input placeholder="Buscar productos, clientes, pedidos..." className="input input-sm input-bordered w-full pl-9 bg-[var(--color-surface-800)] border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)]" />
          </div>

          {/* Mobile brand */}
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 lg:hidden flex-1 min-w-0">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-content font-bold text-xs">T</div>
            <span className="text-sm font-bold tracking-tight text-primary truncate">TECNOGAFAS</span>
          </button>

          <div className="flex-1 lg:flex-none" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {connectionStatus !== 'online' && (
              <div className="badge badge-outline badge-sm gap-1">
                {connectionStatus === 'offline' ? <WifiOff size={11} className="text-error" /> : connectionStatus === 'error' ? <AlertCircle size={11} className="text-warning" /> : <RefreshCw size={11} className="text-primary animate-spin" />}
                <span className="text-[10px]">{connectionStatus === 'offline' ? 'Offline' : connectionStatus === 'error' ? 'Cache' : 'Sync'}</span>
              </div>
            )}
            {onlineUsersCount !== null && (
              <div className="badge badge-sm bg-primary/10 text-primary border-primary/20 gap-1">
                <Users2 size={11} /><span className="text-[10px] font-semibold">{onlineUsersCount}</span>
              </div>
            )}
            <button type="button" onClick={() => navigate('/carrito')} className="btn btn-ghost btn-square btn-sm relative">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="badge badge-primary badge-xs absolute -top-0.5 -right-0.5 border-2 border-base-100 text-[9px]">{cartCount}</span>
              )}
            </button>
          </div>
        </header>

        {/* Error banner */}
        <AnimatePresence>
          {apiError && (
            <motion.div {...getAnimationProps('slide')} className="alert alert-error rounded-none py-2 text-sm">
              <AlertCircle size={14} /><span className="flex-1 truncate text-xs">{apiError}</span>
              <button type="button" onClick={() => window.location.reload()} className="btn btn-ghost btn-xs btn-square"><RefreshCw size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <OptimizedPageTransition pathname={location.pathname}>
            <div className="p-4 lg:p-6 xl:p-8 min-h-full max-w-7xl mx-auto w-full">
              {children}
            </div>
          </OptimizedPageTransition>
        </main>
      </div>
    </div>
  );
}
