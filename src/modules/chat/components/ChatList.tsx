// ============================================================================
// CHAT LIST - Lista de conversaciones con badges y avatars
// ============================================================================

import React, { useMemo } from 'react';
import type { ConversationWithDetails } from '../types';
import { MessageCircle, Users, BellOff, Pin } from 'lucide-react';

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
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay conversaciones</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {sorted.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={`
            w-full flex items-center gap-3 p-3 text-left transition-colors
            hover:bg-gray-50 dark:hover:bg-gray-700/50
            ${selectedId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
          `}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {conv.avatar_url ? (
              <img
                src={conv.avatar_url}
                alt={conv.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {conv.name.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Online indicator (solo para DMs) */}
            {conv.type === 'direct' && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {conv.name}
              </span>
              {conv.is_pinned && <Pin className="w-3 h-3 text-blue-500" />}
              {conv.is_muted && <BellOff className="w-3 h-3 text-gray-400" />}
            </div>
            
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              {conv.type === 'channel' && <Users className="w-3 h-3" />}
              <span className="truncate">
                {conv.member_count || 0} miembros
              </span>
            </div>
          </div>

          {/* Unread Badge */}
          {conv.unread_count > 0 && !conv.is_muted && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
