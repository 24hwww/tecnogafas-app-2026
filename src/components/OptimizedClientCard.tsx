import React, { memo } from 'react';
import { Check, Edit2, Phone, MapPin, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Client } from '../types';

interface OptimizedClientCardProps {
  client: Client;
  isSelected: boolean;
  onSelectClient: (client: Client) => void;
  onEditClient: (client: Client) => (e: React.MouseEvent) => void;
}

export const OptimizedClientCard = memo<OptimizedClientCardProps>(({
  client,
  isSelected,
  onSelectClient,
  onEditClient,
}) => {
  return (
    <div
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
            onClick={onEditClient(client)}
            className="btn btn-ghost btn-square btn-sm"
          >
            <Edit2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

OptimizedClientCard.displayName = 'OptimizedClientCard';
