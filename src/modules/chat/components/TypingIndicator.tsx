// ============================================================================
// TYPING INDICATOR - "Alguien está escribiendo..."
// ============================================================================

import React from 'react';
import { useChat } from '../providers/ChatProvider';

export function TypingIndicator() {
  const { typingUsers } = useChat();

  if (typingUsers.length === 0) return null;

  const getText = () => {
    if (typingUsers.length === 1) {
      const name = typingUsers[0].user?.display_name || 
                   typingUsers[0].user?.username || 
                   'Alguien';
      return `${name} está escribiendo...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers.length} personas están escribiendo...`;
    }
    return 'Varias personas están escribiendo...';
  };

  return (
    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
      {/* Animated Dots */}
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      
      <span>{getText()}</span>
    </div>
  );
}
