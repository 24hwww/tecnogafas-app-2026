// ============================================================================
// CHAT LIST - Lista de conversaciones con badges y avatars
// ============================================================================

import { BellOff, MessageCircle, Pin, Users } from 'lucide-react';
import React, { useMemo } from 'react';
import type { ConversationWithDetails } from '../types';

interface ChatListProps {
  conversations: ConversationWithDetails[];
  selectedId?: string;
  onSelect: (conversation: ConversationWithDetails) => void;
  isLoading?: boolean;
}

export function ChatList({ conversations, selectedId, onSelect, isLoading }: ChatListProps) {
  // Ordenar: pinneds primero, luego por last_message_at
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [conversations]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
            <div className="w-12 h-12 rounded-full bg-surface-variant" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-variant rounded w-3/4" />
              <div className="h-3 bg-surface-variant rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-on-surface-variant">
          <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay conversaciones</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto pr-1 h-full pb-20">
      {sorted.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={`
            w-full m3-card !p-0 overflow-hidden text-left transition-all active:scale-[0.98]
            ${selectedId === conv.id ? 'ring-2 ring-primary border-transparent' : ''}
          `}
        >
          {/* Header de la Card (estilo Orders item header) */}
          <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-primary/5">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm shrink-0 shadow-sm">
                {conv.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate text-on-surface">{conv.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[0.625rem] text-on-surface-variant font-mono font-medium uppercase tracking-tight">
                    {conv.type === 'direct' ? 'CHAT DIRECTO' : 'CANAL PÚBLICO'}
                  </span>
                </div>
              </div>
            </div>

            {conv.is_pinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
          </div>

          {/* Cuerpo de la Card (estilo Orders details) */}
          <div className="p-4 flex justify-between items-center bg-surface">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[0.625rem] text-on-surface-variant uppercase font-bold tracking-wider">
                <Users size={12} />
                <span>{conv.member_count || 0} Miembros</span>
              </div>
              {conv.last_message_at && (
                <p className="text-[0.625rem] text-outline font-medium">
                  ÚLTIMA ACTIVIDAD:{' '}
                  {new Date(conv.last_message_at).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {conv.unread_count > 0 && (
                <span className="bg-error text-white text-[0.7rem] px-2 py-0.5 font-bold rounded-full shadow-sm">
                  {conv.unread_count > 99 ? '99+' : conv.unread_count}
                </span>
              )}
              <ChevronRight size={18} className="text-outline" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

import { ChevronRight } from 'lucide-react';
