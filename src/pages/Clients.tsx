import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { UserPlus, Phone, MapPin, Check, Search, Edit2, X, RefreshCw } from 'lucide-react';
import { Client } from '../types';
import { apiService } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ClientSkeleton } from '../components/Skeleton';

export default function Clients() {
  const { clients, selectedClient, setSelectedClient, refreshData, isLoading } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingClient?.name || !editingClient?.email) return;
    
    setIsSaving(true);
    try {
      const success = await apiService.saveClient(editingClient);
      if (success) {
        setIsModalOpen(false);
        setEditingClient(null);
        await refreshData();
      } else {
        alert('Error al guardar cliente');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red');
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <button 
          onClick={() => { setEditingClient({ name: '', email: '', phone: '', address: '' }); setIsModalOpen(true); }}
          className="m3-button-tonal !p-2"
        >
          <UserPlus size={24} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nombre o correo..." 
          className="w-full bg-surface-variant py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <ClientSkeleton key={i} />)
        ) : (
          filteredClients.map((client) => {
          const isSelected = selectedClient?.id === client.id;
          return (
            <div 
              key={client.id} 
              className={`m3-card relative transition-all border-2 ${
                isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start">
                <div onClick={() => handleSelectClient(client)} className="flex-1 cursor-pointer">
                  <h4 className="font-semibold text-lg">{client.name}</h4>
                  <p className="text-[10px] text-primary font-bold mb-1">{client.email}</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <Phone size={12} /> {client.phone || 'Sin teléfono'}
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {client.address || 'Sin dirección'}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => openEdit(client)}
                    className="p-2 hover:bg-surface text-secondary"
                  >
                    <Edit2 size={18} />
                  </button>
                  {isSelected ? (
                    <div className="bg-primary text-on-primary p-1 self-end">
                      <Check size={16} />
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleSelectClient(client)}
                      className="text-[10px] font-bold text-primary underline"
                    >
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>
      
      {selectedClient && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[calc(448px-2rem)] bg-primary-container p-3 flex justify-between items-center shadow-lg border border-primary/20 z-40">
          <div className="flex-1">
            <span className="text-[10px] uppercase font-black text-primary animate-pulse">Cliente para pedido</span>
            <p className="text-sm font-bold text-on-primary-container truncate">{selectedClient.name}</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/carrito')}
              className="m3-button-filled !px-4 !py-1 text-xs"
            >
              Ver Carrito
            </button>
            <button 
              onClick={() => setSelectedClient(null)}
              className="text-[10px] font-bold text-outline uppercase"
            >
              Quitar
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSaving && setIsModalOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-surface p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingClient?.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1"><X /></button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-outline">Nombre Completo</label>
                  <input 
                    required
                    className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
                    value={editingClient?.name || ''}
                    onChange={e => setEditingClient(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-outline">Correo Electrónico</label>
                  <input 
                    required type="email"
                    className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
                    value={editingClient?.email || ''}
                    onChange={e => setEditingClient(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-outline">Teléfono</label>
                    <input 
                      className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
                      value={editingClient?.phone || ''}
                      onChange={e => setEditingClient(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-outline">Dirección</label>
                    <input 
                      className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
                      value={editingClient?.address || ''}
                      onChange={e => setEditingClient(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full m3-button-filled py-4 flex items-center justify-center gap-2"
                >
                  {isSaving && <RefreshCw size={18} className="animate-spin" />}
                  {editingClient?.id ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
