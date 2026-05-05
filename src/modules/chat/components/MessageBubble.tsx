// ============================================================================
// MESSAGE BUBBLE - Burbuja de mensaje tipo WhatsApp/Telegram
// ============================================================================

import React, { useState } from 'react';
import type { MessageWithAuthor } from '../types';
import { useReactions } from '../hooks/useReactions';
import { useChat } from '../providers/ChatProvider';
import { formatDistanceToNow } from '../lib/dateUtils';
import { MoreVertical } from 'lucide-react';
import { OrderMessageCard } from './OrderMessageCard';
import { NotificationMessage } from './NotificationMessage';

interface MessageBubbleProps {
  message: MessageWithAuthor;
  isCurrentUser: boolean;
  showAvatar: boolean;
  isConsecutive: boolean;
}

const QUICK_REACTIONS = ['❤️', '👍', '🔥', '👀'];

export function MessageBubble({
  message,
  isCurrentUser,
  showAvatar,
  isConsecutive,
}: MessageBubbleProps) {
  const { currentUser } = useChat();
  const { reactions, toggleReaction } = useReactions({
    messageId: message.id,
    currentUserId: currentUser?.id || null,
  });
  const [showMenu, setShowMenu] = useState(false);

  const handleReaction = (emoji: string) => {
    toggleReaction(emoji);
  };

  // Render special message types
  const renderMessageContent = () => {
    // Notificaciones del sistema (pedidos, alertas, etc)
    if (message.user_id === null || ['order', 'alert', 'notification'].includes(message.type)) {
      return (
        <div className={`${isCurrentUser ? 'items-end' : 'items-start'}`}>
          <NotificationMessage message={message} />
        </div>
      );
    }
    
    switch (message.type) {
      case 'order':
        return <OrderMessageCard message={message} />;
      case 'system':
        return (
          <div className="flex items-center justify-center py-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              {message.content}
            </span>
          </div>
        );
      case 'text':
      default:
        return (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        );
    }
  };

  return (
    <div
      className={`
        flex gap-2 group
        ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}
        ${isConsecutive ? 'mt-1' : 'mt-4'}
      `}
    >
      {/* Avatar */}
      {showAvatar && message.user_id ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
          {message.author?.display_name?.charAt(0).toUpperCase() ||
            message.author?.username?.charAt(0).toUpperCase() ||
            '?'}
        </div>
      ) : (
        <div className="flex-shrink-0 w-8" />
      )}

      {/* Content */}
      <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Author Name */}
        {!isCurrentUser && showAvatar && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {message.author?.display_name || message.author?.username || 'Unknown'}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`
            relative px-4 py-2 rounded-2xl
            ${isCurrentUser
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm shadow-sm'
            }
            ${message.is_deleted ? 'opacity-50 italic' : ''}
          `}
        >
          {/* Reply Reference */}
          {message.parent_id && (
            <div className="text-xs opacity-70 mb-1 pb-1 border-b border-current/20">
              Respondiendo a mensaje...
            </div>
          )}

          {/* Message Content */}
          {renderMessageContent()}

          {/* Edited Indicator */}
          {message.is_edited && (
            <span className="text-xs opacity-70 ml-2">(editado)</span>
          )}

          {/* Timestamp */}
          <span className="text-xs opacity-70 ml-2">
            {formatDistanceToNow(message.created_at)}
          </span>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReaction(reaction.emoji)}
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm
                  transition-colors
                  ${reaction.me
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }
                `}
              >
                <span>{reaction.emoji}</span>
                <span className="text-xs">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Reaction Bar (on hover) */}
        {!message.is_deleted && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <span className="text-sm">{emoji}</span>
              </button>
            ))}
            
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
