// ============================================================================
// MESSAGE BUBBLE - Vista Simplificada
// ============================================================================

import React from 'react';
import { formatDistanceToNow } from '../lib/dateUtils';
import { useChat } from '../providers/ChatProvider';
import type { MessageWithAuthor } from '../types';

interface MessageBubbleProps {
  message: MessageWithAuthor;
  isCurrentUser: boolean;
  showAvatar: boolean;
  isConsecutive: boolean;
}

export function MessageBubble({ message, isCurrentUser, isConsecutive }: MessageBubbleProps) {
  const { currentUser } = useChat();

  // Si es un mensaje de sistema o de tipo orden, lo renderizamos simple
  const isSystem =
    message.user_id === null || ['system', 'alert', 'notification'].includes(message.type);

  if (isSystem) {
    return (
      <div className="flex flex-col items-center py-2 px-4 opacity-70">
        <p className="text-xs text-center italic break-words max-w-full">{message.content}</p>
        <span className="text-[10px] mt-0.5">{formatDistanceToNow(message.created_at)}</span>
      </div>
    );
  }

  return (
    <div
      className={`
        flex flex-col mb-4 px-2
        ${isCurrentUser ? 'items-end' : 'items-start'}
      `}
    >
      {/* Autor */}
      <span className="text-[11px] font-bold text-primary mb-0.5 px-1 uppercase tracking-wider">
        {isCurrentUser
          ? 'Tú'
          : message.author?.display_name || message.author?.username || 'Usuario'}
      </span>

      {/* Texto del Mensaje */}
      <div
        className={`
          max-w-[90%] px-3 py-2 rounded-lg text-sm
          ${
            isCurrentUser
              ? 'bg-primary/10 border-r-2 border-primary text-right'
              : 'bg-surface-container border-l-2 border-primary-container text-left'
          }
          ${message.is_deleted ? 'opacity-50 italic' : ''}
        `}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.is_deleted ? 'Mensaje eliminado' : message.content}
        </p>
      </div>

      {/* Tiempo transcurrido */}
      <span className="text-[10px] opacity-50 mt-1 px-1">
        {formatDistanceToNow(message.created_at)} {message.is_edited ? '(editado)' : ''}
      </span>
    </div>
  );
}
