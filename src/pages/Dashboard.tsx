import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { TrendingUp, Users, Package, ShoppingBag, RefreshCw, Activity, Zap, Download, Smartphone } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { Skeleton } from '../components/Skeleton';

export default function Dashboard() {
  const { products, clients, grandTotalOrders, dashboardOrders, sellers, refreshData, forceRefresh, isLoading, appVersionInfo } = useApp();
  const navigate = useNavigate();
  
  const stats = [
    { label: 'Vendedores', value: sellers.length, icon: Users, color: 'text-green-600' },
    { label: 'Clientes', value: clients.length, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Productos', value: products.length, icon: Package, color: 'text-purple-600' },
    { label: 'Pedidos', value: grandTotalOrders, icon: ShoppingBag, color: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 id="dashboard-title" className="text-2xl font-bold text-on-surface">Inicio</h2>
        <div className="flex gap-2">
          <button 
            id="dashboard-refresh-btn"
            onClick={() => refreshData()} 
            disabled={isLoading}
            className={`p-2 hover:bg-surface-variant transition-all ${isLoading ? 'animate-spin' : ''}`}
            title="Sincronizar"
          >
            <RefreshCw size={20} className="text-primary" />
          </button>
          <button 
            id="dashboard-force-refresh-btn"
            onClick={() => forceRefresh()} 
            disabled={isLoading}
            className={`p-2 m3-button !rounded-full shadow-lg ${isLoading ? 'animate-pulse' : ''}`}
            title="Limpiar Caché y Forzar Recarga"
          >
            <Zap size={20} className="text-on-primary" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <div key={stat.label} className="m3-card !items-start space-y-4 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2">
                <span className="text-[0.625rem] font-bold uppercase tracking-widest text-outline">{stat.label}</span>
              </div>
              <stat.icon size={16} className={`${stat.color || 'text-primary'}/40`} />
            </div>
            <div className="space-y-1 w-full">
              {isLoading ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <span className="text-2xl font-black tracking-tight text-on-surface">{stat.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="m3-card !bg-surface-variant/40 space-y-6">
        <div className="flex justify-between items-center">
          <h3 id="dashboard-orders-title" className="font-bold text-sm uppercase tracking-widest text-primary">Pedidos</h3>
          <button 
            id="dashboard-view-all-orders-btn"
            onClick={() => navigate('/pedidos')}
            className="text-[0.625rem] bg-primary/10 text-primary px-2 py-0.5 font-bold hover:bg-primary/20 transition-colors"
          >
            Ver todo
          </button>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10" />
                  <div className="space-y-2">
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-16 h-3" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-10 h-2" />
                </div>
              </div>
            ))}
          </div>
        ) : dashboardOrders.length === 0 ? (
          <div className="text-center py-6">
            <ShoppingBag className="mx-auto text-outline mb-2 opacity-20" size={40} />
            <p className="text-xs text-outline font-medium">No hay pedidos registrados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dashboardOrders.slice(0, 4).map((order) => (
              <div key={order.id} className="flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface flex items-center justify-center font-bold text-primary border border-white/5">
                    {order.clientName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-on-surface">{order.clientName}</p>
                    <p className="text-[0.625rem] text-outline font-medium capitalize">{new Date(order.createdAt).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm text-primary">{formatCurrency(order.total || 0)}</p>
                  <p className="text-[0.5rem] uppercase tracking-tighter text-outline">Confirmado</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {appVersionInfo && appVersionInfo.success && (
        <div className="m3-card !bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Download className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 id="dashboard-download-apk-title" className="font-bold text-blue-900">Aplicación Android</h3>
              <p className="text-xs text-blue-700 font-medium mb-1">Versión {appVersionInfo.version}</p>
              <p className="text-[0.65rem] text-blue-600/70 mb-3">{appVersionInfo.release_notes}</p>
              <a 
                id="dashboard-download-apk-btn"
                href={appVersionInfo.apk_url}
                className="m3-button-filled !px-4 !py-2 !bg-blue-600 hover:!bg-blue-700 text-xs font-bold inline-flex items-center gap-2"
              >
                <Smartphone className="text-white" size={16} />
                Descargar APK
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
