// ============================================================================
// CHAT MODULE - Exports
// ============================================================================

// Types
export * from './types';

// Hooks
export { useMessages } from './hooks/useMessages';
export { useConversations } from './hooks/useConversations';
export { useReactions } from './hooks/useReactions';
export { useTyping } from './hooks/useTyping';

// Provider
export { ChatProvider, useChat, ChatContext } from './providers/ChatProvider';

// Database
export {
  chatDB,
  saveConversations,
  getConversations,
  saveMessages,
  getMessages,
  addReaction,
  removeReaction,
  clearAllData,
} from './stores/chatDatabase';

// Supabase
export { supabase, channelManager, cleanupSupabase } from './lib/supabase';

// Components
export { ChatLayout } from './components/ChatLayout';
export { ChatList } from './components/ChatList';
export { ChatMessageList } from './components/ChatMessageList';
export { MessageBubble } from './components/MessageBubble';
export { ChatInput } from './components/ChatInput';
export { TypingIndicator } from './components/TypingIndicator';
export { OrderMessageCard } from './components/OrderMessageCard';
export { NotificationMessage } from './components/NotificationMessage';
