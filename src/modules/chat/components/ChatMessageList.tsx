// ============================================================================
// CHAT MESSAGE LIST - Lista de mensajes con virtualización básica
// ============================================================================

import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { useChat } from '../providers/ChatProvider';
import { MessageBubble } from './MessageBubble';

export function ChatMessageList() {
  const { messages, isLoading, hasMore, loadMore, currentUser } = useChat();
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll al fondo cuando hay nuevos mensajes
  useEffect(() => {
    if (bottomRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Solo auto-scroll si el mensaje es del usuario actual o es muy reciente
      if (
        lastMessage.user_id === currentUser?.id ||
        new Date().getTime() - new Date(lastMessage.created_at).getTime() < 5000
      ) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, currentUser?.id]);

  // Infinite scroll (load more)
  const handleScroll = useCallback(() => {
    if (!listRef.current || !hasMore || isLoading) return;

    const { scrollTop } = listRef.current;
    if (scrollTop < 100) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-2 py-4 space-y-2 bg-surface"
    >
      {/* Cargar más mensajes */}
      {hasMore && (
        <div className="flex justify-center pb-6">
          <button
            onClick={(e) => {
              e.preventDefault();
              loadMore();
            }}
            disabled={isLoading}
            className={`
              text-xs px-4 py-2 rounded-full border border-primary/20
              transition-all active:scale-95
              ${isLoading ? 'bg-surface-variant text-gray-400' : 'bg-primary/5 text-primary hover:bg-primary/10'}
            `}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Cargando...</span>
              </div>
            ) : (
              'Ver mensajes anteriores'
            )}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-2">
          <p className="text-sm">No hay mensajes aún</p>
          <p className="text-xs italic text-center px-8">
            Inicia la conversación enviando un mensaje abajo.
          </p>
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const isConsecutive = prevMessage?.user_id === message.user_id;

        return (
          <MessageBubble
            key={message.id}
            message={message}
            isCurrentUser={message.user_id === currentUser?.id}
            showAvatar={!isConsecutive}
            isConsecutive={isConsecutive}
          />
        );
      })}

      {/* Bottom Anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
