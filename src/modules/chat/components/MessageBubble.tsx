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
      <div className="flex justify-center py-3 px-4 opacity-70">
        <div className="bg-base-200/50 rounded-lg px-4 py-3 max-w-md text-center">
          <p className="text-sm text-center italic break-words">{message.content}</p>
          <span className="text-xs text-base-500 mt-2">
            {formatDistanceToNow(message.created_at)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        flex mb-6 px-3
        ${isCurrentUser ? 'justify-end' : 'justify-start'}
      `}
    >
      {/* Autor y timestamp */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xs font-bold text-primary px-2 py-1 bg-base-100 rounded-full">
          {isCurrentUser
            ? 'Tú'
            : message.author?.display_name || message.author?.username || 'Usuario'}
        </span>
        <span className="text-[10px] opacity-60">{formatDistanceToNow(message.created_at)}</span>
      </div>

      {/* Texto del Mensaje */}
      <div
        className={`
          max-w-[80%] px-4 py-3 rounded-xl text-sm shadow-sm
          ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground rounded-br-2xl ml-auto'
              : 'bg-base-100 border border-base-300 rounded-bl-2xl mr-auto'
          }
          ${message.is_deleted ? 'opacity-50 italic' : ''}
        `}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed text-base">
          {message.is_deleted ? 'Mensaje eliminado' : message.content}
        </p>
      </div>

      {/* Indicador de edición */}
      {message.is_edited && <span className="text-[10px] opacity-60 italic ml-2">(editado)</span>}
    </div>
  );
}
