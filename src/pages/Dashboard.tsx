import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from 'idb-keyval';
import { useApp } from '../AppContext';
import { TrendingUp, Users, Package, ShoppingBag, RefreshCw, Activity, Zap, Download, Smartphone } from 'lucide-react';
import { formatCurrency, getRelativeTime, formatTimeBA } from '../lib/utils';
import { Skeleton } from '../components/Skeleton';

export default function Dashboard() {
  const { products, clients, grandTotalOrders, dashboardOrders, sellers, refreshData, forceRefresh, clearAllCaches, isLoading, appVersionInfo } = useApp();
  const navigate = useNavigate();
  const [hasCache, setHasCache] = useState(false);

  useEffect(() => {
    const checkCache = async () => {
      const cached = await get('tecnogafas_products');
      setHasCache(!!cached);
    };
    checkCache();
  }, []);

  const stats = [
    { label: 'Vendedores', value: sellers.length, icon: Users, color: 'text-green-600' },
    { label: 'Clientes', value: clients.length, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Productos', value: products.length, icon: Package, color: 'text-purple-600' },
    { label: 'Pedidos', value: grandTotalOrders, icon: ShoppingBag, color: 'text-orange-600' },
  ];

  // Helper para obtener nombre del vendedor por ID
  const getSellerName = (sellerId: string) => {
    const seller = sellers.find(s => s.id === sellerId);
    return seller?.name || 'Vendedor desconocido';
  };

  // Helper para extraer número de pedido del título (formato: "Pedido #12345" o similar)
  const getOrderNumber = (title: string) => {
    const match = title.match(/#(\d+)/);
    return match ? `#${match[1]}` : '';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 id="dashboard-title" className="text-h2">Inicio</h2>
        <div className="flex gap-1">
          <button 
            id="dashboard-refresh-btn"
            onClick={() => refreshData()} 
            disabled={isLoading}
            className={`p-2.5 hover:bg-surface-variant rounded-full transition-all ${isLoading ? 'animate-spin' : ''}`}
            title="Sincronizar"
          >
            <RefreshCw size={20} className="text-primary" />
          </button>
          <button
            id="dashboard-force-refresh-btn"
            onClick={async () => {
              await clearAllCaches();
              setHasCache(false);
            }}
            disabled={isLoading}
            className={`p-2.5 rounded-full transition-colors ${isLoading ? 'animate-pulse' : ''} ${hasCache ? 'bg-error text-white' : 'hover:bg-surface-variant text-primary'}`}
            title={hasCache ? "Limpiar Caché" : "Caché vacía"}
          >
            <Zap size={20} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <div key={stat.label} className="m3-card !items-start space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: `${i * 75}ms` }}>
            <div className="flex justify-between items-center w-full">
              <span className="text-label">{stat.label}</span>
              <div className={cn("p-1.5 rounded-lg bg-surface-variant/50", stat.color.replace('text-', 'text-'))}>
                <stat.icon size={16} />
              </div>
            </div>
            <div className="space-y-1 w-full">
              {isLoading ? (
                <Skeleton className="h-9 w-20 mb-1" />
              ) : (
                <span className="text-3xl font-black tracking-tight text-on-surface">{stat.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h3 id="dashboard-orders-title" className="text-h3">Pedidos Recientes</h3>
          <button 
            id="dashboard-view-all-orders-btn"
            onClick={() => navigate('/pedidos')}
            className="text-xs font-bold text-primary hover:underline"
          >
            Ver todos
          </button>
        </div>
        
        <div className="m3-card !p-0 overflow-hidden divide-y divide-outline/5">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-20 h-3" />
                    </div>
                  </div>
                  <Skeleton className="w-16 h-4" />
                </div>
              ))}
            </div>
          ) : dashboardOrders.length === 0 ? (
            <div className="text-center py-10 px-4">
              <ShoppingBag className="mx-auto text-on-surface-variant/20 mb-3" size={48} />
              <p className="text-body-sm">No hay pedidos registrados.</p>
            </div>
          ) : (
            dashboardOrders.slice(0, 5).map((order) => (
              <div 
                key={order.id} 
                className="flex justify-between items-center p-4 hover:bg-surface-variant/30 transition-colors cursor-pointer group"
                onClick={() => navigate('/pedidos')}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center font-bold shrink-0">
                    {order.clientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-on-surface truncate">{order.clientName}</p>
                      {order.rawData?.post_title && getOrderNumber(order.rawData.post_title) && (
                        <span className="text-[0.65rem] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded-md font-mono font-bold">
                          {getOrderNumber(order.rawData.post_title)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[0.65rem] text-on-surface-variant font-medium uppercase tracking-tighter">
                        {new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} • {formatTimeBA(order.createdAt)} HS
                      </p>
                      <p className="text-[0.6rem] text-on-surface-variant/70 italic">
                        Por {getSellerName(order.sellerId)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-primary">{formatCurrency(order.total || 0)}</p>
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-success">Confirmado</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {appVersionInfo && appVersionInfo.success && (
        <div className="m3-card !bg-primary/5 border-primary/20">
          <div className="flex items-center gap-5">
            <div className="bg-primary-container p-4 rounded-2xl text-on-primary-container shadow-sm">
              <Smartphone size={28} />
            </div>
            <div className="flex-1">
              <h3 id="dashboard-download-apk-title" className="text-base font-bold text-on-surface">Nueva Versión Disponible</h3>
              <p className="text-body-sm mb-3">Actualiza a la versión {appVersionInfo.version} para obtener las últimas mejoras.</p>
              <a 
                id="dashboard-download-apk-btn"
                href={appVersionInfo.apk_url}
                className="m3-button-filled !py-2 !text-xs w-full"
              >
                <Download size={16} />
                Descargar APK
              </a>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
