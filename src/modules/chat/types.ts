// ============================================================================
// TIPOS TYPESCRIPT - SISTEMA DE CHAT REALTIME
// Arquitectura: Discord + Slack + Telegram hybrid
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export enum ConversationType {
	CHANNEL = "channel",
	GROUP = "group",
	DIRECT = "direct",
}

export enum MessageType {
	TEXT = "text",
	SYSTEM = "system",
	ORDER = "order",
	ALERT = "alert",
	NOTIFICATION = "notification",
	MEDIA = "media",
	FILE = "file",
	VOICE = "voice",
	POLL = "poll",
}

export enum MemberRole {
	OWNER = "owner",
	ADMIN = "admin",
	MODERATOR = "moderator",
	MEMBER = "member",
}

export enum UserStatus {
	ONLINE = "online",
	AWAY = "away",
	DND = "dnd",
	OFFLINE = "offline",
}

export enum RealtimeEventType {
	MESSAGE_INSERT = "message_insert",
	MESSAGE_UPDATE = "message_update",
	MESSAGE_DELETE = "message_delete",
	REACTION_INSERT = "reaction_insert",
	REACTION_DELETE = "reaction_delete",
	TYPING_START = "typing_start",
	TYPING_STOP = "typing_stop",
	PRESENCE_CHANGE = "presence_change",
	MEMBER_JOIN = "member_join",
	MEMBER_LEAVE = "member_leave",
	CONVERSATION_UPDATE = "conversation_update",
}

// ============================================================================
// INTERFACES BASE DE SUPABASE
// ============================================================================

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: Profile;
				Insert: Omit<Profile, "created_at" | "updated_at">;
				Update: Partial<Omit<Profile, "id" | "created_at">>;
			};
			conversations: {
				Row: Conversation;
				Insert: Omit<
					Conversation,
					| "id"
					| "created_at"
					| "updated_at"
					| "message_count"
					| "last_message_at"
				>;
				Update: Partial<Omit<Conversation, "id" | "created_by" | "created_at">>;
			};
			conversation_members: {
				Row: ConversationMember;
				Insert: Omit<ConversationMember, "id" | "created_at" | "updated_at">;
				Update: Partial<
					Omit<
						ConversationMember,
						"id" | "conversation_id" | "user_id" | "joined_at"
					>
				>;
			};
			messages: {
				Row: Message;
				Insert: Omit<
					Message,
					| "id"
					| "created_at"
					| "updated_at"
					| "reply_count"
					| "reaction_count"
					| "is_edited"
				>;
				Update: Partial<
					Omit<Message, "id" | "conversation_id" | "user_id" | "created_at">
				>;
			};
			message_reactions: {
				Row: MessageReaction;
				Insert: Omit<MessageReaction, "id" | "created_at">;
				Update: never;
			};
			message_reads: {
				Row: MessageRead;
				Insert: Omit<MessageRead, "id" | "read_at">;
				Update: never;
			};
			typing_status: {
				Row: TypingStatus;
				Insert: Omit<TypingStatus, "id" | "started_at">;
				Update: Partial<
					Omit<TypingStatus, "id" | "conversation_id" | "user_id">
				>;
			};
			user_presence: {
				Row: UserPresence;
				Insert: Omit<UserPresence, "updated_at">;
				Update: Partial<Omit<UserPresence, "user_id">>;
			};
			pending_orders: {
				Row: PendingOrderRow;
				Insert: Omit<
					PendingOrderRow,
					"id" | "created_at" | "updated_at" | "attempt_count" | "status"
				>;
				Update: Partial<
					Omit<PendingOrderRow, "id" | "seller_id" | "created_at">
				>;
			};
		};
	};
}

export interface PendingOrderRow {
	id: string;
	seller_id: string;
	seller_name: string | null;
	client_id: string;
	client_data: Record<string, unknown>;
	items: Record<string, unknown>[];
	details: Record<string, unknown> | null;
	status: "pending" | "syncing" | "failed" | "completed";
	attempt_count: number;
	last_error: string | null;
	last_attempt_at: string | null;
	api_response: Record<string, unknown> | null;
	synced_order_id: string | null;
	created_at: string;
	updated_at: string;
}

// ============================================================================
// INTERFACES PRINCIPALES
// ============================================================================

export interface Profile {
	id: string;
	username: string | null;
	display_name: string | null;
	avatar_url: string | null;
	status: UserStatus;
	status_message: string | null;
	last_seen_at: string;
	metadata: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface Conversation {
	id: string;
	type: ConversationType;
	slug: string | null;
	name: string;
	description: string | null;
	avatar_url: string | null;
	created_by: string;
	is_archived: boolean;
	is_private: boolean;
	metadata: Record<string, unknown>;
	settings: ConversationSettings;
	last_message_at: string | null;
	message_count: number;
	member_count: number;
	created_at: string;
	updated_at: string;
}

export interface ConversationSettings {
	slow_mode: number;
	allow_reactions: boolean;
	allow_threads: boolean;
	allow_editing: boolean;
	allow_deleting: boolean;
}

export interface ConversationMember {
	id: string;
	conversation_id: string;
	user_id: string;
	role: MemberRole;
	joined_at: string;
	last_read_at: string;
	unread_count: number;
	is_muted: boolean;
	is_pinned: boolean;
	notifications: NotificationSettings;
	metadata: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface NotificationSettings {
	all: boolean;
	mentions: boolean;
	replies: boolean;
}

export interface Message {
	id: string;
	conversation_id: string;
	parent_id: string | null;
	user_id: string | null;
	type: MessageType;
	content: string;
	content_html: string | null;
	metadata: Record<string, unknown>;
	order_data: OrderData | null;
	alert_data: AlertData | null;
	attachments: Attachment[];
	reply_count: number;
	reaction_count: number;
	is_edited: boolean;
	is_deleted: boolean;
	edited_at: string | null;
	deleted_at: string | null;
	deleted_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface OrderData {
	order_id: string;
	order_number: string;
	status: string;
	total: number;
	items?: OrderItem[];
	items_count?: number;
	customer_name?: string;
	customer_email?: string;
	url?: string;
}

export interface OrderItem {
	id: string;
	name: string;
	quantity: number;
	price: number;
	image_url?: string;
}

export interface AlertData {
	level: "info" | "warning" | "error" | "success";
	title: string;
	action?: {
		label: string;
		url: string;
	};
}

export interface Attachment {
	id: string;
	type: "image" | "video" | "audio" | "file";
	url: string;
	name: string;
	size: number;
	mime_type: string;
	width?: number;
	height?: number;
	duration?: number;
	thumbnail_url?: string;
}

export interface MessageReaction {
	id: string;
	message_id: string;
	user_id: string;
	emoji: string;
	created_at: string;
}

export interface ReactionGroup {
	emoji: string;
	count: number;
	users: string[];
	me: boolean;
}

export interface MessageRead {
	id: string;
	message_id: string;
	user_id: string;
	read_at: string;
}

export interface TypingStatus {
	id: string;
	conversation_id: string;
	user_id: string;
	started_at: string;
	expires_at: string;
}

export interface UserPresence {
	user_id: string;
	status: UserStatus;
	last_active_at: string;
	device_info: DeviceInfo;
	ip_address: string | null;
	updated_at: string;
}

export interface DeviceInfo {
	type?: "mobile" | "tablet" | "desktop";
	platform?: string;
	browser?: string;
}

// ============================================================================
// INTERFACES ENRIQUECIDAS (para UI)
// ============================================================================

export interface MessageWithAuthor extends Message {
	author?: Profile;
	reactions?: ReactionGroup[];
	is_read?: boolean;
	pending?: boolean;
	error?: string;
}

export interface ConversationWithDetails extends Conversation {
	member?: ConversationMember;
	unread_count: number;
	last_read_at: string;
	user_role: MemberRole;
	is_muted: boolean;
	is_pinned: boolean;
	other_participants?: Profile[]; // Para chats directos
}

export interface TypingUser extends TypingStatus {
	user?: Profile;
}

// ============================================================================
// TIPOS PARA EVENTOS REALTIME
// ============================================================================

export interface RealtimeMessagePayload {
	type:
		| RealtimeEventType.MESSAGE_INSERT
		| RealtimeEventType.MESSAGE_UPDATE
		| RealtimeEventType.MESSAGE_DELETE;
	conversationId: string;
	message: MessageWithAuthor;
	previous?: Partial<Message>;
}

export interface RealtimeReactionPayload {
	type: RealtimeEventType.REACTION_INSERT | RealtimeEventType.REACTION_DELETE;
	conversationId: string;
	messageId: string;
	emoji: string;
	userId: string;
}

export interface RealtimeTypingPayload {
	type: RealtimeEventType.TYPING_START | RealtimeEventType.TYPING_STOP;
	conversationId: string;
	userId: string;
	user?: Profile;
}

export interface RealtimePresencePayload {
	type: RealtimeEventType.PRESENCE_CHANGE;
	userId: string;
	status: UserStatus;
	last_active_at: string;
}

export interface RealtimeMemberPayload {
	type: RealtimeEventType.MEMBER_JOIN | RealtimeEventType.MEMBER_LEAVE;
	conversationId: string;
	userId: string;
	user?: Profile;
}

export interface RealtimeConversationPayload {
	type: RealtimeEventType.CONVERSATION_UPDATE;
	conversation: Conversation;
	changes: Partial<Conversation>;
}

export type RealtimePayload =
	| RealtimeMessagePayload
	| RealtimeReactionPayload
	| RealtimeTypingPayload
	| RealtimePresencePayload
	| RealtimeMemberPayload
	| RealtimeConversationPayload;

// ============================================================================
// TIPOS PARA API/HOOKS
// ============================================================================

export interface SendMessageInput {
	conversation_id: string;
	content: string;
	parent_id?: string;
	type?: MessageType;
	metadata?: Record<string, unknown>;
	attachments?: Omit<Attachment, "id">[];
}

export interface UpdateMessageInput {
	content: string;
}

export interface CreateConversationInput {
	type: ConversationType;
	name: string;
	description?: string;
	slug?: string;
	is_private?: boolean;
	member_ids?: string[];
	metadata?: Record<string, unknown>;
}

export interface JoinConversationInput {
	conversation_id: string;
}

export interface MarkAsReadInput {
	conversation_id: string;
	message_id: string;
}

export interface SetTypingInput {
	conversation_id: string;
	is_typing: boolean;
}

// ============================================================================
// TIPOS PARA CACHE/STORE
// ============================================================================

export interface CachedMessage extends MessageWithAuthor {
	synced_at: string;
	pending?: boolean;
	error?: string;
}

export interface CachedConversation extends ConversationWithDetails {
	synced_at: string;
	messages?: CachedMessage[];
}

export interface PendingOperation {
	id: string;
	type:
		| "send_message"
		| "update_message"
		| "delete_message"
		| "add_reaction"
		| "remove_reaction";
	payload: unknown;
	created_at: string;
	retry_count: number;
}

export interface SyncState {
	last_sync_at: string;
	conversations_synced: string[];
	pending_operations: PendingOperation[];
	is_online: boolean;
}

// ============================================================================
// TIPOS PARA UI COMPONENTS
// ============================================================================

export interface ChatListProps {
	conversations: ConversationWithDetails[];
	selectedId?: string;
	onSelect: (conversation: ConversationWithDetails) => void;
	onCreateConversation?: () => void;
}

export interface ChatMessageListProps {
	messages: MessageWithAuthor[];
	currentUserId: string;
	hasMore: boolean;
	isLoading: boolean;
	onLoadMore: () => void;
	onReply: (message: MessageWithAuthor) => void;
	onReact: (messageId: string, emoji: string) => void;
	onEdit: (message: MessageWithAuthor) => void;
	onDelete: (messageId: string) => void;
}

export interface ChatInputProps {
	onSend: (content: string, attachments?: Attachment[]) => void;
	onTyping: () => void;
	replyTo?: MessageWithAuthor | null;
	onCancelReply?: () => void;
	disabled?: boolean;
	placeholder?: string;
}

export interface MessageBubbleProps {
	message: MessageWithAuthor;
	isCurrentUser: boolean;
	showAvatar: boolean;
	isConsecutive: boolean;
	onReply: () => void;
	onReact: (emoji: string) => void;
	onEdit: () => void;
	onDelete: () => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Helper type para paginación
export interface PaginatedResult<T> {
	data: T[];
	hasMore: boolean;
	nextCursor?: string;
}

// Helper type para estados de carga
export interface AsyncState<T> {
	data: T | null;
	isLoading: boolean;
	error: Error | null;
}

// Tipos para el contexto global del chat
export interface ChatContextValue {
	// Estado
	currentUser: Profile | null;
	conversations: ConversationWithDetails[];
	activeConversation: ConversationWithDetails | null;
	messages: MessageWithAuthor[];
	typingUsers: TypingUser[];
	onlineUsers: Set<string>;
	isConnected: boolean;
	isLoading: boolean;
	hasMore: boolean;
	error: Error | null;

	// Acciones
	setActiveConversation: (conversation: ConversationWithDetails | null) => void;
	sendMessage: (
		input: Omit<SendMessageInput, "conversation_id">,
	) => Promise<void>;
	updateMessage: (
		messageId: string,
		input: UpdateMessageInput,
	) => Promise<void>;
	deleteMessage: (messageId: string) => Promise<void>;
	addReaction: (messageId: string, emoji: string) => Promise<void>;
	removeReaction: (messageId: string, emoji: string) => Promise<void>;
	markAsRead: (conversationId: string, messageId: string) => Promise<void>;
	setTyping: (conversationId: string, isTyping: boolean) => void;
	createConversation: (input: CreateConversationInput) => Promise<Conversation>;
	joinConversation: (conversationId: string) => Promise<void>;
	leaveConversation: (conversationId: string) => Promise<void>;
	archiveConversation: (conversationId: string) => Promise<void>;
	pinConversation: (conversationId: string, pinned: boolean) => Promise<void>;
	muteConversation: (conversationId: string, muted: boolean) => Promise<void>;
	loadMore: () => Promise<void>;
	refresh: () => Promise<void>;
}
