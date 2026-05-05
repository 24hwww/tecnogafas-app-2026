// ============================================================================
// CHAT LAYOUT - Layout principal tipo Discord/Telegram
// Mobile-first con sidebar colapsable
// ============================================================================

import React, { useState } from 'react';
import { useChat } from '../providers/ChatProvider';
import { ChatList } from './ChatList';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Menu, X, ChevronLeft } from 'lucide-react';

interface ChatLayoutProps {
  className?: string;
}

export function ChatLayout({ className = '' }: ChatLayoutProps) {
  const { conversations, activeConversation, isLoading, setActiveConversation } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectConversation = (conv: typeof activeConversation) => {
    setActiveConversation(conv);
    setSidebarOpen(false);
  };

  return (
    <div className={`flex h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Sidebar - Conversations List */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Conversaciones
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat List */}
          <ChatList
            conversations={conversations}
            selectedId={activeConversation?.id}
            onSelect={handleSelectConversation}
            isLoading={isLoading}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {activeConversation && (
            <>
              <button
                onClick={() => setActiveConversation(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-semibold text-gray-900 dark:text-white truncate">
                {activeConversation.name}
              </h1>
            </>
          )}
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {activeConversation ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {activeConversation.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white">
                  {activeConversation.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeConversation.member_count || 0} miembros
                </p>
              </div>
            </div>
          ) : (
            <h1 className="font-semibold text-gray-900 dark:text-white">
              Selecciona una conversación
            </h1>
          )}
        </header>

        {/* Messages Area */}
        {activeConversation ? (
          <>
            <div className="flex-1 overflow-hidden">
              <ChatMessageList />
            </div>
            
            <TypingIndicator />
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <ChatInput />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <Menu className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                Selecciona una conversación para comenzar
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
