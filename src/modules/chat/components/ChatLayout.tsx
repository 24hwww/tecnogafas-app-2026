// ============================================================================
// CHAT LAYOUT - Layout minimalista integrado con la App
// ============================================================================

import React, { useState } from 'react';
import { useChat } from '../providers/ChatProvider';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ChatList } from './ChatList';
import { TypingIndicator } from './TypingIndicator';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { PullToRefresh } from '../../../components/PullToRefresh';

interface ChatLayoutProps {
  className?: string;
}

export function ChatLayout({ className = '' }: ChatLayoutProps) {
  const { 
    activeConversation, 
    setActiveConversation, 
    conversations, 
    isLoading
  } = useChat();

  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(conv => 
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = async () => {
    // Refresh disabled until properly implemented
  };

  // Si hay una conversación activa, mostramos el chat
  if (activeConversation) {
    return (
      <div className={`flex flex-col h-dvh bg-background ${className}`}>
        {/* Header compacto estilo chat */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline/10 bg-surface shrink-0">
          <h2 className="text-lg font-semibold flex-1 truncate">{activeConversation.name}</h2>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`p-2 hover:bg-surface-variant rounded-full transition-all ${isLoading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={18} className="text-primary" />
          </button>
        </div>

        {/* Messages Area - ocupa todo el espacio restante */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <ChatMessageList />
        </div>

        {/* Footer Area with Input - siempre abajo */}
        <div className="p-3 bg-surface border-t border-outline/10 shrink-0">
          <TypingIndicator />
          <ChatInput />
        </div>
      </div>
    );
  }

  // Si no hay conversación activa, mostramos la lista de chats (estilo Orders list)
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className={`space-y-8 min-h-[50vh] ${className}`}>
        {/* Header estilo Orders */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Chat</h2>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`p-2.5 hover:bg-surface-variant rounded-full transition-all ${isLoading ? 'animate-spin' : ''}`}
            title="Sincronizar"
          >
            <RefreshCw size={20} className="text-primary" />
          </button>
        </div>


        {/* Lista estilo Orders cards */}
        <div className="flex-1 overflow-hidden">
          <ChatList 
            conversations={filteredConversations} 
            onSelect={setActiveConversation}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PullToRefresh>
  );
}
