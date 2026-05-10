// ============================================================================
// CHAT BUBBLE - Simple Style like WhatsApp
// ============================================================================

import React from 'react';
import { formatDistanceToNow } from '../lib/dateUtils';
import type { MessageWithAuthor } from '../types';
import './ChatBubble.css';

interface ChatBubbleProps {
  message: MessageWithAuthor;
  isCurrentUser: boolean;
  isConsecutive: boolean;
}

export function ChatBubble({ message, isCurrentUser, isConsecutive }: ChatBubbleProps) {
  // const { currentUser } = useChat(); // No longer needed for simple style

  // Determinar el tipo de mensaje para estilos específicos
  const isSystem =
    message.user_id === null || ['system', 'alert', 'notification'].includes(message.type);
  const isOrder = message.type === 'order';
  const isFile = message.type === 'file';
  const isImage = message.type === 'media';

  // Estado del mensaje (para indicadores como "Seen" o "Delivered")
  const messageStatus = message.is_read ? 'Seen' : 'Delivered';

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2 px-4`}>
      {/* Nombre del autor para mensajes recibidos */}
      {!isCurrentUser && !isConsecutive && (
        <div className="text-xs text-base-content/60 mb-1">
          {message.author?.display_name || message.author?.username || 'Usuario'}
        </div>
      )}

      {/* Burbuja de mensaje simple estilo WhatsApp */}
      <div
        className={`
          relative max-w-xs lg:max-w-md px-4 py-2 rounded-2xl
          ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-base-200 text-base-content rounded-bl-sm'
          }
          ${message.is_deleted ? 'opacity-50 italic' : ''}
        `}
      >
        {/* Mensajes de sistema */}
        {isSystem && (
          <div className="text-center text-sm text-base-content/70">{message.content}</div>
        )}

        {/* Mensajes de orden */}
        {isOrder && (
          <div className="text-sm">
            <div className="font-semibold text-success">📦 Nuevo pedido</div>
            <div>{message.content}</div>
          </div>
        )}

        {/* Mensajes de archivo */}
        {isFile && (
          <div className="text-sm">
            <div className="font-semibold text-warning">📎 Archivo</div>
            <div>{message.content}</div>
          </div>
        )}

        {/* Mensajes de imagen */}
        {isImage && (
          <div className="text-sm">
            <div className="font-semibold text-info">🖼️ Imagen</div>
            <div>{message.content}</div>
          </div>
        )}

        {/* Mensajes de texto normales */}
        {!isSystem && !isOrder && !isFile && !isImage && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.is_deleted ? 'Mensaje eliminado' : message.content}
          </p>
        )}

        {/* Indicador de edición */}
        {message.is_edited && !isSystem && (
          <span className="text-xs opacity-60 italic ml-1">editado</span>
        )}
      </div>

      {/* Timestamp y estado para mensajes enviados */}
      {isCurrentUser && (
        <div className="flex items-end gap-1 ml-2 mb-1">
          <span className="text-xs text-base-content/50">
            {formatDistanceToNow(message.created_at)}
          </span>
          <span className="text-xs text-base-content/50">{messageStatus}</span>
        </div>
      )}

      {/* Timestamp para mensajes recibidos */}
      {!isCurrentUser && (
        <div className="flex items-end gap-1 mr-2 mb-1">
          <span className="text-xs text-base-content/50">
            {formatDistanceToNow(message.created_at)}
          </span>
        </div>
      )}
    </div>
  );
}
