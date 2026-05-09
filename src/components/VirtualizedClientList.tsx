import { Check, Edit2, MapPin, Phone, UserPlus } from 'lucide-react';
import { type CSSProperties, memo, useMemo } from 'react';
import { List } from 'react-window';
import { cn } from '../lib/utils';
import type { Client } from '../types';

interface VirtualizedClientListProps {
  clients: Client[];
  selectedClient: Client | null;
  onSelectClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  isLoading?: boolean;
}

interface ListItemProps {
  index: number;
  style: CSSProperties;
  data: {
    clients: Client[];
    selectedClient: Client | null;
    onSelectClient: (client: Client) => void;
    onEditClient: (client: Client) => void;
  };
}

const VirtualizedClientItem = memo(({ index, style, data }: ListItemProps) => {
  const { clients, selectedClient, onSelectClient, onEditClient } = data;
  const client = clients[index];

  if (!client) {
    return <div style={style} />;
  }

  const isSelected = selectedClient?.id === client.id;

  return (
    <div style={style} className="p-1">
      <div
        className={cn(
          'card bg-base-100 shadow-sm border-2 p-4 transition-all',
          isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-base-300/40',
        )}
      >
        <div className="flex justify-between items-start">
          <div onClick={() => onSelectClient(client)} className="flex-1 cursor-pointer">
            <h4 className="font-semibold text-base">{client.name}</h4>
            <p className="text-xs text-primary font-semibold mb-1">{client.email}</p>
            <p className="text-xs opacity-50 flex items-center gap-1 mt-1">
              <Phone size={12} /> {client.phone || 'Sin teléfono'}
            </p>
            <p className="text-xs opacity-50 flex items-center gap-1 mt-1">
              <MapPin size={12} /> {client.address || 'Sin dirección'}
            </p>
            <div className="mt-3">
              <button
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
    </div>
  );
});

VirtualizedClientItem.displayName = 'VirtualizedClientItem';

export const VirtualizedClientList = memo(
  ({
    clients,
    selectedClient,
    onSelectClient,
    onEditClient,
    isLoading,
  }: VirtualizedClientListProps) => {
    const itemData = useMemo(
      () => ({
        clients,
        selectedClient,
        onSelectClient,
        onEditClient,
      }),
      [clients, selectedClient, onSelectClient, onEditClient],
    );

    if (isLoading && clients.length === 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="card bg-base-100 shadow-sm border-2 p-4 animate-pulse">
                <div className="h-4 bg-base-300 rounded mb-2"></div>
                <div className="h-3 bg-base-300 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-base-300 rounded w-1/2"></div>
              </div>
            ))}
        </div>
      );
    }

    if (clients.length === 0) {
      return (
        <div className="card bg-base-100 shadow-sm border-2 border-dashed py-20 flex flex-col items-center text-center opacity-50">
          <div className="w-16 h-16 bg-base-300 rounded-full mb-4"></div>
          <p className="text-xl font-bold">No se encontraron clientes</p>
          <p className="text-sm mt-2">Intenta ajustar la búsqueda</p>
        </div>
      );
    }

    return (
      <div className="h-[500px]">
        <List
          height={500}
          itemCount={clients.length}
          itemSize={160}
          itemData={itemData}
          className="space-y-2"
          children={VirtualizedClientItem}
        />
      </div>
    );
  },
);

VirtualizedClientList.displayName = 'VirtualizedClientList';
