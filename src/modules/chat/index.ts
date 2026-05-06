// ============================================================================
// CHAT MODULE - Exports
// ============================================================================

export { ChatInput } from "./components/ChatInput";
// Components
export { ChatLayout } from "./components/ChatLayout";
export { ChatList } from "./components/ChatList";
export { ChatMessageList } from "./components/ChatMessageList";
export { MessageBubble } from "./components/MessageBubble";
export { NotificationMessage } from "./components/NotificationMessage";
export { OrderMessageCard } from "./components/OrderMessageCard";
export { TypingIndicator } from "./components/TypingIndicator";
export { useConversations } from "./hooks/useConversations";
// Hooks
export { useMessages } from "./hooks/useMessages";
export { useReactions } from "./hooks/useReactions";
export { useTyping } from "./hooks/useTyping";
// Supabase
export { channelManager, cleanupSupabase, supabase } from "./lib/supabase";
// Provider
export { ChatContext, ChatProvider, useChat } from "./providers/ChatProvider";
// Database
export {
	addReaction,
	chatDB,
	clearAllData,
	getConversations,
	getMessages,
	removeReaction,
	saveConversations,
	saveMessages,
} from "./stores/chatDatabase";
// Types
export * from "./types";
