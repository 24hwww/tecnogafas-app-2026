// ============================================================================
// PÁGINA: CHAT (antes Notificaciones)
// Chat completo con notificaciones integradas
// Layout: Mensajes arriba (scroll), Input en footer
// ============================================================================

import React from 'react';
import { ChatProvider } from '../modules/chat/providers/ChatProvider';
import { ChatLayout } from '../modules/chat/components/ChatLayout';
import { useApp } from '../AppContext';

export default function Chat() {
  // Obtener vendedor/usuario actual desde AppContext
  const { currentSeller } = useApp();

  const currentUser = currentSeller ? {
    id: String(currentSeller.id),
    username: currentSeller.nombre?.split(' ')[0].toLowerCase() || 'usuario',
    display_name: currentSeller.nombre || 'Usuario',
    avatar_url: null,
  } : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header de la página */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl">
              💬
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Chat
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Mensajes y notificaciones
              </p>
            </div>
          </div>
          
          {currentUser && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                {currentUser.display_name}
              </span>
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                {currentUser.display_name?.charAt(0).toUpperCase() || '?'}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Área principal del Chat */}
      <main className="flex-1 overflow-hidden">
        <ChatProvider 
          currentUserId={currentUser?.id || null}
          currentUser={currentUser}
        >
          <ChatLayout className="h-full" />
        </ChatProvider>
      </main>
    </div>
  );
}
