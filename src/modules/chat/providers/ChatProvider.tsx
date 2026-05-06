import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from "react";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";
import { useTyping } from "../hooks/useTyping";
import type { ChatContextValue, ConversationWithDetails } from "../types";

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error("useChat must be used within a ChatProvider");
	}
	return context;
}

interface ChatProviderProps {
	children: React.ReactNode;
	currentUserId: string | null;
	currentUser: { id: string; username?: string; avatar_url?: string } | null;
}

export function ChatProvider({
	children,
	currentUserId,
	currentUser,
}: ChatProviderProps) {
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
		setActiveConversation,
		activeConversation,
	} = useConversationsState(currentUserId);

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
		refresh,
	} = useMessages({
		conversationId: activeConversation?.id || null,
		currentUserId,
	});

	const { typingUsers, startTyping, stopTyping } = useTyping({
		conversationId: activeConversation?.id || null,
		currentUserId,
	});

	const isLoading = conversationsLoading || messagesLoading;
	const error = conversationsError || messagesError;

	const onlineUsers = useMemo(() => {
		const online = new Set<string>();
		typingUsers.forEach((u) => online.add(u.user_id));
		if (currentUserId) online.add(currentUserId);
		return online;
	}, [typingUsers, currentUserId]);

	const value: ChatContextValue = useMemo(
		() => ({
			currentUser: currentUser as unknown as ChatContextValue["currentUser"],
			conversations,
			activeConversation,
			messages,
			typingUsers,
			onlineUsers,
			isConnected: true,
			isLoading,
			isLoadingMore,
			hasMore,
			error,

			setActiveConversation,
			sendMessage: (input) => sendMessage(input),
			updateMessage,
			deleteMessage,
			loadMore,
			refresh,
			addReaction: async () => {}, // TODO
			removeReaction: async () => {}, // TODO
			markAsRead: async (c) => await markConversationAsRead(c),
			setTyping: (_id, typing) => (typing ? startTyping() : stopTyping()),
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
			isLoadingMore,
			hasMore,
			error,
			setActiveConversation,
			sendMessage,
			updateMessage,
			deleteMessage,
			loadMore,
			refresh,
			markConversationAsRead,
			startTyping,
			stopTyping,
			createConversation,
			joinConversation,
			leaveConversation,
			archiveConversation,
			pinConversation,
			muteConversation,
		],
	);

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

function useConversationsState(currentUserId: string | null) {
	const [activeConversation, setActiveConversationState] =
		React.useState<ConversationWithDetails | null>(null);

	const conversationsHook = useConversations(currentUserId);

	const setActiveConversation = useCallback(
		(conversation: ConversationWithDetails | null) => {
			setActiveConversationState(conversation);
		},
		[],
	);

	// Auto-select default conversation when list loads
	useEffect(() => {
		if (!activeConversation && conversationsHook.conversations.length > 0) {
			const notifChannel = conversationsHook.conversations.find(
				(c) => c.slug === "notificaciones",
			);
			setActiveConversationState(
				notifChannel || conversationsHook.conversations[0],
			);
		}
	}, [conversationsHook.conversations, activeConversation]);

	return {
		...conversationsHook,
		activeConversation,
		setActiveConversation,
	};
}
