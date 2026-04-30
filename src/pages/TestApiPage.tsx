import { useState } from 'react';
import { apiService } from '../services/apiService';

export default function TestApiPage() {
  const [results, setResults] = useState<any[]>([]);
  const [sellerId, setSellerId] = useState('20061088'); // PIN del vendedor para pruebas
  const [testOrderId, setTestOrderId] = useState('26341'); // Example

  const addResult = (name: string, result: any) => {
    setResults(prev => [...prev, { name, result, time: new Date().toLocaleTimeString() }]);
  };

  const runTest = async (name: string, fn: () => Promise<any>) => {
    try {
      const result = await fn();
      addResult(name, result);
    } catch (e: any) {
      addResult(name, { error: e.message });
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="p-6 bg-surface text-on-surface min-h-screen">
      <h1 className="text-2xl font-black mb-6">🛠️ API Test Bench</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-surface-variant p-4 rounded-xl">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-outline">PIN Vendedor</label>
          <input type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} className="bg-surface p-3 rounded-lg border border-outline/20 outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-outline">Order ID</label>
          <input type="text" value={testOrderId} onChange={e => setTestOrderId(e.target.value)} className="bg-surface p-3 rounded-lg border border-outline/20 outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-bold mb-3">📡 Eventos y Notificaciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button className="bg-blue-600 text-white p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Login Seller', () => apiService.loginSeller(sellerId))}>Login con PIN</button>
          <button className="bg-blue-600 text-white p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Events', () => apiService.getEvents(undefined, sellerId))}>Get Events</button>
          <button className="bg-blue-600 text-white p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Unread Count', () => apiService.getUnreadCount(sellerId))}>Get Unread Count</button>
          <button className="bg-purple-600 text-white p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Create Test Event', () => apiService.createEvent({ user_id: 1, type: 'notification', content: { title: 'Test', body: 'Mensaje de prueba' } }, sellerId))}>Crear Evento Test</button>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-bold mb-3">📦 Productos y Pedidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button className="bg-primary text-on-primary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Products', () => apiService.getProducts())}>Get Products</button>
          <button className="bg-primary text-on-primary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Clients', () => apiService.getClients())}>Get Clients</button>
          <button className="bg-primary text-on-primary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Orders', () => apiService.getOrders(1, 25, sellerId))}>Get Orders</button>
          <button className="bg-primary text-on-primary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Sellers', () => apiService.getSellers())}>Get Sellers</button>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-bold mb-3">⚡ Acciones de Pedidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button className="bg-secondary text-on-secondary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Update Status', () => apiService.updateOrderStatus(testOrderId, 'attended', sellerId))}>Update Status</button>
          <button className="bg-secondary text-on-secondary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Download PDF', () => apiService.downloadOrderPdf(testOrderId, sellerId))}>Download PDF</button>
          <button className="bg-secondary text-on-secondary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Send Email', () => apiService.sendOrderEmail(testOrderId, sellerId))}>Send Email</button>
          <button className="bg-tertiary text-on-tertiary p-3 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform" onClick={() => runTest('Get Logs', () => apiService.getLogs(`POST /pedido/${testOrderId}/enviar`, sellerId))}>Get Logs</button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Results Log</h2>
        <button onClick={clearResults} className="text-sm text-red-500 hover:text-red-400 font-bold">Limpiar</button>
      </div>
      
      <div className="space-y-4">
        {results.map((r, i) => (
          <div key={i} className="bg-surface rounded-xl border border-outline/10 p-4 shadow-sm">
            <p className="font-mono font-bold text-sm text-primary mb-2 flex justify-between">
              <span>{r.name}</span>
              <span className="text-outline/60">{r.time}</span>
            </p>
            <pre className="text-xs bg-surface-variant p-3 rounded-lg overflow-x-auto text-on-surface-variant">{typeof r.result === 'object' ? JSON.stringify(r.result, null, 2) : String(r.result)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
