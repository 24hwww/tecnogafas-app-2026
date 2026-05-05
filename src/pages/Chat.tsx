// ============================================================================
// PÁGINA: CHAT
// Chat completo con notificaciones integradas
// ============================================================================

import React from 'react';
import { ChatLayout } from '../modules/chat/components/ChatLayout';

export default function Chat() {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -m-4">
      <ChatLayout />
    </div>
  );
}
