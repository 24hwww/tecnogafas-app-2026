// ============================================================================
// CHAT PROVIDER - Contexto global del sistema de chat
// Arquitectura: React Context + Hooks composition
// ============================================================================

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import type {
  ChatContextValue,
  ConversationWithDetails,
  SendMessageInput,
} from '../types';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { useTyping } from '../hooks/useTyping';

// ============================================================================
// CONTEXT
// ============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// HOOK
// ============================================================================

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER PROPS
// ============================================================================

interface ChatProviderProps {
  children: React.ReactNode;
  currentUserId: string | null;
  currentUser: { id: string; username?: string; avatar_url?: string } | null;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function ChatProvider({ children, currentUserId, currentUser }: ChatProviderProps) {
  // ============================================================================
  // CONVERSATIONS STATE
  // ============================================================================

  const {
    conversations,
    isLoading: conversationsLoading,
    error: conversationsError,
    createConversation,
    joinConversation,
    leaveConversation,
    archiveConversation,
    pinConversation,
    muteConversation,
    markAsRead: markConversationAsRead,
    refresh: refreshConversations,
    setActiveConversation,
    activeConversation,
  } = useConversationsState(currentUserId);

  // ============================================================================
  // MESSAGES STATE (depende de activeConversation)
  // ============================================================================

  const {
    messages,
    isLoading: messagesLoading,
    isLoadingMore,
    hasMore,
    error: messagesError,
    sendMessage,
    updateMessage,
    deleteMessage,
    loadMore,
    refresh: refreshMessages,
  } = useMessages({
    conversationId: activeConversation?.id || null,
    currentUserId,
  });

  // ============================================================================
  // TYPING STATE
  // ============================================================================

  const {
    typingUsers,
    startTyping,
    stopTyping,
    isTyping,
  } = useTyping({
    conversationId: activeConversation?.id || null,
    currentUserId,
  });

  // ============================================================================
  // COMBINED STATE
  // ============================================================================

  const isLoading = conversationsLoading || messagesLoading;
  const error = conversationsError || messagesError;

  // ============================================================================
  // ONLINE USERS (simplificado - basado en typing status)
  // ============================================================================

  const onlineUsers = useMemo(() => {
    const online = new Set<string>();
    typingUsers.forEach((u) => online.add(u.user_id));
    if (currentUserId) online.add(currentUserId);
    return online;
  }, [typingUsers, currentUserId]);

  // ============================================================================
  // WRAPPED ACTIONS
  // ============================================================================

  const handleSendMessage = useCallback(
    async (input: Omit<SendMessageInput, 'conversation_id'>) => {
      await sendMessage(input);
      stopTyping();
    },
    [sendMessage, stopTyping]
  );

  const handleSetTyping = useCallback(
    (conversationId: string, isTypingNow: boolean) => {
      if (isTypingNow) {
        startTyping();
      } else {
        stopTyping();
      }
    },
    [startTyping, stopTyping]
  );

  const handleMarkAsRead = useCallback(
    async (conversationId: string, messageId: string) => {
      await markConversationAsRead(conversationId);
    },
    [markConversationAsRead]
  );

  // ============================================================================
  // REACTIONS (per-message, handled via hook in components)
  // ============================================================================

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      // This is a placeholder - actual implementation uses useReactions hook per message
      console.log('[ChatProvider] Add reaction:', messageId, emoji);
    },
    []
  );

  const removeReaction = useCallback(
    async (messageId: string, emoji: string) => {
      console.log('[ChatProvider] Remove reaction:', messageId, emoji);
    },
    []
  );

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: ChatContextValue = useMemo(
    () => ({
      // Estado
      currentUser: currentUser as ChatContextValue['currentUser'],
      conversations,
      activeConversation,
      messages,
      typingUsers,
      onlineUsers,
      isConnected: true, // TODO: implement connection status
      isLoading,
      error,

      // Acciones
      setActiveConversation,
      sendMessage: handleSendMessage,
      updateMessage,
      deleteMessage,
      addReaction,
      removeReaction,
      markAsRead: handleMarkAsRead,
      setTyping: handleSetTyping,
      createConversation,
      joinConversation,
      leaveConversation,
      archiveConversation,
      pinConversation,
      muteConversation,
    }),
    [
      currentUser,
      conversations,
      activeConversation,
      messages,
      typingUsers,
      onlineUsers,
      isLoading,
      error,
      setActiveConversation,
      handleSendMessage,
      updateMessage,
      deleteMessage,
      addReaction,
      removeReaction,
      handleMarkAsRead,
      handleSetTyping,
      createConversation,
      joinConversation,
      leaveConversation,
      archiveConversation,
      pinConversation,
      muteConversation,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ============================================================================
// CONVERSATIONS STATE WRAPPER
// ============================================================================

function useConversationsState(currentUserId: string | null) {
  const [activeConversation, setActiveConversationState] =
    React.useState<ConversationWithDetails | null>(null);

  const conversationsHook = useConversations(currentUserId);

  const setActiveConversation = useCallback(
    (conversation: ConversationWithDetails | null) => {
      setActiveConversationState(conversation);
      // Marcar como leído al seleccionar
      if (conversation && conversation.unread_count > 0) {
        conversationsHook.markAsRead(conversation.id);
      }
    },
    [conversationsHook]
  );

  return {
    ...conversationsHook,
    activeConversation,
    setActiveConversation,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ChatContext };
