import {
  Building2,
  Check,
  Edit2,
  IdCard,
  MapPin,
  MapPinned,
  Phone,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type React from 'react';
import { useMemo, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { PullToRefresh } from '../components/PullToRefresh';
import { ClientSkeleton } from '../components/Skeleton';
import { useCart } from '../contexts/CartContext';
import { cn } from '../lib/utils';
import { apiService } from '../services/apiService';
import type { Client } from '../types';

interface ClientCardProps {
  client: Client;
  isSelected: boolean;
  onSelectClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
}

const ClientCard = memo(({ client, isSelected, onSelectClient, onEditClient }: ClientCardProps) => (
  <div
    key={client.id}
    className={cn(
      'card bg-base-100 shadow-sm border-2 p-4 transition-all',
      isSelected
        ? 'border-primary bg-primary/5 shadow-md'
        : 'border-base-300/40',
    )}
  >
    <div className="flex justify-between items-start">
      <div
        onClick={() => onSelectClient(client)}
        className="flex-1 cursor-pointer"
      >
        <h4 className="font-semibold text-base">{client.name}</h4>
        <p className="text-xs text-primary font-semibold mb-1">
          {client.email}
        </p>
        <p className="text-xs opacity-50 flex items-center gap-1 mt-1">
          <Phone size={12} /> {client.phone || 'Sin teléfono'}
        </p>
        <p className="text-xs opacity-50 flex items-center gap-1 mt-1">
          <MapPin size={12} /> {client.address || 'Sin dirección'}
        </p>
        <div className="mt-3">
          <button
            id={`clients-select-btn-${client.id}`}
            type="button"
            onClick={() => onSelectClient(client)}
            className={cn(
              'btn btn-sm w-full gap-2',
              isSelected ? 'btn-success' : 'btn-primary',
            )}
          >
            {isSelected ? <Check size={14} /> : <UserPlus size={14} />}
            {isSelected ? 'Seleccionado' : 'Agregar'}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button
          id={`clients-edit-btn-${client.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditClient(client);
          }}
          className="btn btn-ghost btn-square btn-sm"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  </div>
));

ClientCard.displayName = 'ClientCard';

export default function Clients() {
  const { clients, refreshData, isLoading } = useApp();
  const { selectedClient, setSelectedClient } = useCart();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredClients = useMemo(() => clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  ), [clients, search]);

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

  const openEdit = useCallback((client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  }, []);

  const handleSelectClient = useCallback((client: Client) => {
    setSelectedClient(client);
  }, [setSelectedClient]);

  return (
    <PullToRefresh onRefresh={() => refreshData(false)}>
      <div className="space-y-4 min-h-[50vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="clients-title" className="text-2xl font-bold">
            Clientes
          </h2>
          <button
            id="clients-add-btn"
            type="button"
            onClick={() => {
              setEditingClient({
                name: '',
                email: '',
                phone: '',
                address: '',
                billing_city: '',
                billing_state: '',
                cuit: '',
              });
              setIsModalOpen(true);
            }}
            className="btn btn-ghost btn-square btn-sm text-primary"
          >
            <UserPlus size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={18} />
          <input
            id="clients-search-input"
            type="text"
            placeholder="Buscar por nombre o correo..."
            className="input input-bordered w-full pl-10 bg-base-200/50 focus:bg-base-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Client List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isLoading && clients.length === 0
            ? Array(6)
                .fill(0)
                .map((_, i) => <ClientSkeleton key={i} />)
            : filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                isSelected={selectedClient?.id === client.id}
                onSelectClient={handleSelectClient}
                onEditClient={openEdit}
              />
            ))}
        </div>

        {/* Selected Client Sticky Bar */}
        {selectedClient && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-primary text-primary-content p-3 flex justify-between items-center shadow-xl rounded-2xl z-40">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold opacity-70 animate-pulse">
                Cliente para pedido
              </span>
              <p className="text-sm font-bold truncate">
                {selectedClient.name}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button type="button" onClick={() => navigate('/carrito')} className="btn btn-sm btn-neutral">
                Ver Carrito
              </button>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="text-[10px] font-bold opacity-70 uppercase text-center hover:opacity-100"
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
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                className="relative w-full max-w-md bg-base-100 p-6 shadow-2xl space-y-5 rounded-t-2xl sm:rounded-2xl"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">
                    {editingClient?.id ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h3>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost btn-square btn-sm">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveClient} className="space-y-3">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase opacity-60">Nombre Completo</span>
                    </label>
                    <input
                      required
                      className="input input-bordered w-full bg-base-200/50"
                      value={editingClient?.name || ''}
                      onChange={(e) =>
                        setEditingClient((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase opacity-60">Correo Electrónico</span>
                    </label>
                    <input
                      required
                      type="email"
                      className="input input-bordered w-full bg-base-200/50"
                      value={editingClient?.email || ''}
                      onChange={(e) =>
                        setEditingClient((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase opacity-60">Teléfono</span>
                      </label>
                      <input
                        className="input input-bordered w-full bg-base-200/50"
                        value={editingClient?.phone || ''}
                        onChange={(e) =>
                          setEditingClient((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase opacity-60">Dirección</span>
                      </label>
                      <input
                        className="input input-bordered w-full bg-base-200/50"
                        value={editingClient?.address || ''}
                        onChange={(e) =>
                          setEditingClient((prev) => ({ ...prev, address: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase opacity-60 flex items-center gap-1">
                          <Building2 size={12} /> Localidad
                        </span>
                      </label>
                      <input
                        className="input input-bordered w-full bg-base-200/50"
                        value={editingClient?.billing_city || ''}
                        onChange={(e) =>
                          setEditingClient((prev) => ({ ...prev, billing_city: e.target.value }))
                        }
                      />
                    </div>
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase opacity-60 flex items-center gap-1">
                          <MapPinned size={12} /> Provincia
                        </span>
                      </label>
                      <select
                        className="select select-bordered w-full bg-base-200/50"
                        value={editingClient?.billing_state || ''}
                        onChange={(e) =>
                          setEditingClient((prev) => ({ ...prev, billing_state: e.target.value }))
                        }
                      >
                        <option value="">Seleccionar provincia</option>
                        <option value="Buenos Aires">Buenos Aires</option>
                        <option value="Ciudad Autónoma de Buenos Aires">
                          Ciudad Autónoma de Buenos Aires
                        </option>
                        <option value="Catamarca">Catamarca</option>
                        <option value="Chaco">Chaco</option>
                        <option value="Chubut">Chubut</option>
                        <option value="Córdoba">Córdoba</option>
                        <option value="Corrientes">Corrientes</option>
                        <option value="Entre Ríos">Entre Ríos</option>
                        <option value="Formosa">Formosa</option>
                        <option value="Jujuy">Jujuy</option>
                        <option value="La Pampa">La Pampa</option>
                        <option value="La Rioja">La Rioja</option>
                        <option value="Mendoza">Mendoza</option>
                        <option value="Misiones">Misiones</option>
                        <option value="Neuquén">Neuquén</option>
                        <option value="Río Negro">Río Negro</option>
                        <option value="Salta">Salta</option>
                        <option value="San Juan">San Juan</option>
                        <option value="San Luis">San Luis</option>
                        <option value="Santa Cruz">Santa Cruz</option>
                        <option value="Santa Fe">Santa Fe</option>
                        <option value="Santiago del Estero">Santiago del Estero</option>
                        <option value="Tierra del Fuego, Antártida e Islas del Atlántico Sur">
                          Tierra del Fuego
                        </option>
                        <option value="Tucumán">Tucumán</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase opacity-60 flex items-center gap-1">
                        <IdCard size={12} /> CUIT
                      </span>
                    </label>
                    <input
                      className="input input-bordered w-full bg-base-200/50"
                      value={editingClient?.cuit || ''}
                      onChange={(e) =>
                        setEditingClient((prev) => ({ ...prev, cuit: e.target.value }))
                      }
                      placeholder="XX-XXXXXXXX-X"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn btn-primary w-full mt-2"
                  >
                    {isSaving && <span className="loading loading-spinner loading-xs" />}
                    {editingClient?.id ? 'Guardar Cambios' : 'Crear Cliente'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}
