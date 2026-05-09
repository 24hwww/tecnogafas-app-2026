import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Download,
  Mail,
  Package,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { AnimatedStatNumber } from '../components/ui/AnimatedStatNumber';
import { Skeleton } from '../components/ui/Skeleton';
import { useCart } from '../contexts/CartContext';
import { useOrders } from '../contexts/OrdersContext';
import { cn, formatCurrency, formatTimeBA, getAnimationProps } from '../lib/utils';
import { appDB } from '../stores/appDatabase';

/* ── Skeleton blocks ── */
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {Array(4)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-4"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-14" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        ))}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-5 w-14 ml-auto rounded-full" />
            </div>
          </div>
        ))}
    </div>
  );
}

export default function Dashboard() {
  const { products, clients, sellers, refreshData, clearAllCaches, isLoading, appVersionInfo } =
    useApp();
  const { grandTotalOrders } = useOrders();
  const [dashboardOrders, setDashboardOrders] = useState<Order[]>([]);
  const [isLoadingRecentOrders, setIsLoadingRecentOrders] = useState(false);
  const { drafts } = useCart();
  const navigate = useNavigate();
  const [hasCache, setHasCache] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [serverStats, setServerStats] = useState<{
    total_clientes?: number;
    total_usuarios?: number;
    total_productos?: number;
    total_pedidos?: number;
    pedidos_ultimas_24h?: number;
    items_ultimas_24h?: number;
    pedidos_mes_actual?: number;
    items_mes_actual?: number;
    productos_mas_pedidos_24h?: Array<{
      product_id: number;
      variation_id: number;
      name: string;
      total_quantity: number;
      order_count: number;
    }>;
    productos_mas_pedidos_mes?: Array<{
      product_id: number;
      variation_id: number;
      name: string;
      total_quantity: number;
      order_count: number;
    }>;
  } | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [lastStatsUpdate, setLastStatsUpdate] = useState<Date | null>(null);

  // Load server stats function
  const loadServerStats = async (showLoading = false) => {
    try {
      if (showLoading) setIsRefreshingStats(true);
      const { apiService } = await import('../services/apiService');
      const stats = await apiService.getStats();
      if (stats.success) {
        setServerStats(stats.data);
        setLastStatsUpdate(new Date());
        console.log(
          '[Dashboard] Estadísticas actualizadas:',
          new Date().toLocaleTimeString('es-AR'),
        );
      }
    } catch (error) {
      console.error('Error loading server stats:', error);
    } finally {
      if (showLoading) setIsRefreshingStats(false);
    }
  };

  // Load recent orders function - always from API
  const loadRecentOrders = async () => {
    try {
      setIsLoadingRecentOrders(true);
      const { apiService } = await import('../services/apiService');
      const orders = await apiService.getRecentOrders();
      setDashboardOrders(orders);
      console.log(
        '[Dashboard] Pedidos recientes actualizados desde API:',
        new Date().toLocaleTimeString('es-AR'),
      );
    } catch (error) {
      console.error('Error loading recent orders:', error);
    } finally {
      setIsLoadingRecentOrders(false);
    }
  };

  useEffect(() => {
    const checkCache = async () => {
      try {
        const count = await appDB.products.count();
        setHasCache(count > 0);
      } catch {
        setHasCache(false);
      }
    };
    checkCache();

    // Initial load
    loadServerStats();
    loadRecentOrders();

    // Set up automatic refresh every 5 minutes
    const interval = setInterval(
      () => {
        loadServerStats();
        loadRecentOrders();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(
    () => [
      {
        label: 'Vendedores',
        value: serverStats?.total_usuarios || sellers.length,
        icon: Users,
        color: 'text-emerald-400 bg-emerald-500/10',
      },
      {
        label: 'Clientes',
        value: serverStats?.total_clientes || clients.length,
        icon: TrendingUp,
        color: 'text-sky-400 bg-sky-500/10',
      },
      {
        label: 'Productos',
        value: serverStats?.total_productos || products.length,
        icon: Package,
        color: 'text-violet-400 bg-violet-500/10',
      },
      {
        label: 'Pedidos',
        value: serverStats?.total_pedidos || grandTotalOrders,
        icon: ShoppingBag,
        color: 'text-amber-400 bg-amber-500/10',
      },
    ],
    [serverStats, sellers.length, clients.length, products.length, grandTotalOrders],
  );

  const newStats = useMemo(
    () => [
      {
        label: 'Pedidos 24h',
        value: serverStats?.pedidos_ultimas_24h || 0,
        icon: Clock,
        color: 'text-orange-400 bg-orange-500/10',
      },
      {
        label: 'Items 24h',
        value: serverStats?.items_ultimas_24h || 0,
        icon: BarChart3,
        color: 'text-pink-400 bg-pink-500/10',
      },
      {
        label: 'Pedidos Mes',
        value: serverStats?.pedidos_mes_actual || 0,
        icon: Calendar,
        color: 'text-indigo-400 bg-indigo-500/10',
      },
      {
        label: 'Items Mes',
        value: serverStats?.items_mes_actual || 0,
        icon: Package,
        color: 'text-teal-400 bg-teal-500/10',
      },
    ],
    [serverStats],
  );

  const getSellerName = useMemo(
    () => (sellerId: string) => {
      const seller = sellers.find((s) => s.id === sellerId);
      return seller?.name || 'Vendedor desconocido';
    },
    [sellers],
  );

  const getOrderNumber = (title: string) => {
    const match = title.match(/#(\d+)/);
    return match ? `#${match[1]}` : '';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div {...getAnimationProps('fade')} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inicio</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Panel principal de gestión</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm border border-[var(--color-border)]"
            onClick={async () => {
              await refreshData();
              await loadServerStats(true);
              await loadRecentOrders();
            }}
            disabled={isLoading || isRefreshingStats}
            title="Sincronizar datos y estadísticas"
          >
            <RefreshCw
              size={16}
              className={cn((isLoading || isRefreshingStats) && 'animate-spin')}
            />
          </button>
          <button
            type="button"
            className={cn(
              'btn btn-square btn-sm',
              hasCache ? 'btn-error' : 'btn-ghost border border-[var(--color-border)]',
            )}
            onClick={async () => {
              const pendingDrafts = drafts.filter((d) => d.status === 'no enviado');
              if (pendingDrafts.length > 0) {
                setShowDraftsModal(true);
                return;
              }
              await clearAllCaches();
              setHasCache(false);
              await refreshData(false);
              await loadServerStats(true);
            }}
            disabled={isLoading || isRefreshingStats}
            title={hasCache ? 'Limpiar Caché' : 'Caché vacía'}
          >
            <Zap size={16} />
          </button>
        </div>
      </motion.div>

      {/* Stats Grid — with skeleton */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <motion.div {...getAnimationProps('slide')} className="space-y-6">
          {/* Original Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                {...getAnimationProps('scale')}
                transition={{ delay: i * 0.06 }}
              >
                <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-4 hover:border-primary/30 transition-all duration-200">
                  <div className="flex justify-between items-start w-full">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">
                        {stat.label}
                      </p>
                      <AnimatedStatNumber
                        value={stat.value}
                        className="text-2xl font-bold tracking-tight"
                      />
                    </div>
                    <div className={cn('p-2.5 rounded-xl', stat.color)}>
                      <stat.icon size={18} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* New Stats with Charts */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {lastStatsUpdate && (
                    <span className="ml-2 text-xs text-gray-400">
                      Actualizado:{' '}
                      {lastStatsUpdate.toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </p>
              </div>
              {isRefreshingStats && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Actualizando estadísticas...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {newStats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  {...getAnimationProps('scale')}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] p-4 hover:border-primary/30 transition-all duration-200">
                    <div className="flex justify-between items-start w-full">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[var(--color-text-muted)]">
                          {stat.label}
                        </p>
                        <AnimatedStatNumber
                          value={stat.value}
                          className="text-2xl font-bold tracking-tight"
                        />
                      </div>
                      <div className={cn('p-2.5 rounded-xl', stat.color)}>
                        <stat.icon size={18} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Orders — with skeleton */}
      <motion.div {...getAnimationProps('slide')} className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-xl lg:text-2xl font-semibold tracking-tight">Pedidos Recientes</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Últimas transacciones registradas
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-primary"
            onClick={() => navigate('/pedidos')}
          >
            Ver todos
          </button>
        </div>

        {isLoadingRecentOrders ? (
          <OrdersSkeleton />
        ) : dashboardOrders.length === 0 ? (
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] text-center py-12 px-4">
            <ShoppingBag className="mx-auto opacity-20 mb-4" size={48} />
            <p className="text-[var(--color-text-muted)]">No hay pedidos registrados.</p>
          </div>
        ) : (
          <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {dashboardOrders.slice(0, 5).map((order, index) => (
              <motion.div
                key={order.id}
                {...getAnimationProps('slide')}
                transition={{ delay: index * 0.04 }}
                className="flex justify-between items-center p-4 hover:bg-base-300/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/pedidos?id=${order.id}`)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="avatar placeholder">
                    <div className="bg-primary/10 text-primary rounded-full w-10 h-10 flex items-center justify-center border border-primary/20">
                      <span className="text-sm font-black">{order.clientName.charAt(0)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{order.clientName}</p>
                      {order.rawData?.post_title && getOrderNumber(order.rawData.post_title) && (
                        <span className="badge badge-ghost badge-sm font-mono text-[10px]">
                          {getOrderNumber(order.rawData.post_title)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Date(order.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}{' '}
                        • {formatTimeBA(order.createdAt)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        Por {getSellerName(order.sellerId)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm text-primary">
                    {formatCurrency(order.total || 0)}
                  </p>
                  <span className="badge badge-success badge-sm gap-1 text-[10px]">Guardado</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* App Version Card */}
      {appVersionInfo && appVersionInfo.success && (
        <motion.div {...getAnimationProps('scale')}>
          <div className="card bg-primary/5 border border-primary/20">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div className="bg-primary text-primary-content p-3 rounded-2xl shadow-sm">
                  <Smartphone size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Nueva Versión Disponible</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    Actualiza a la versión {appVersionInfo.version} para obtener las últimas
                    mejoras.
                  </p>
                  <a href={appVersionInfo.apk_url} className="btn btn-primary w-full">
                    <Download size={16} /> Descargar APK
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Drafts Modal */}
      {showDraftsModal && (
        <motion.div
          {...getAnimationProps('fade')}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            {...getAnimationProps('scale')}
            className="card bg-base-200 shadow-2xl max-w-md w-full border border-[var(--color-border)]"
          >
            <div className="card-body text-center space-y-4">
              <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} className="text-error" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Pedidos en Borrador</h3>
                <p className="text-[var(--color-text-muted)]">
                  Tienes{' '}
                  <strong>
                    {drafts.filter((d) => d.status === 'no enviado').length} pedido(s)
                  </strong>{' '}
                  en borrador sin enviar.
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Si limpias el caché, se perderán permanentemente.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => {
                    setShowDraftsModal(false);
                    navigate('/pedidos', { state: { highlightDrafts: true } });
                  }}
                >
                  <Mail size={18} /> Ir a Pedidos para Enviar
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-error w-full"
                  onClick={async () => {
                    setShowDraftsModal(false);
                    await clearAllCaches();
                    setHasCache(false);
                  }}
                >
                  <Trash2 size={18} /> Limpiar de Todos Modos
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => setShowDraftsModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
