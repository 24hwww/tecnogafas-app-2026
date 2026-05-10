// ============================================================================
// OFFLINE-FIRST DATABASE - DEXIE + SUPABASE SYNC
// Arquitectura: PWA con soporte offline completo
// ============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  CachedConversation,
  CachedMessage,
  ConversationMember,
  LocalMessage,
  Message,
  MessageReaction,
  PendingOperation,
  Profile,
  SyncState,
  TypingStatus,
  UnauthenticatedMessageQueue,
  UserPresence,
} from '../modules/chat/types';
import type { CartItem, Client, DraftOrder, Order, Product, Seller, SharedCart } from '../types';

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

export interface LocalPendingOrder {
  id: string;
  sellerId: string;
  sellerName?: string;
  client: Client;
  items: CartItem[];
  details: {
    commit?: string;
    discount?: number | string;
    recargo?: number | string;
    transport?: string;
    methodpay?: string;
    otheremail?: string;
    iva?: number | string;
    sendEmail?: boolean;
  };
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  attemptCount: number;
  lastError?: string;
  lastAttemptAt?: string;
  syncedOrderId?: string;
  supabaseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectedClientRecord extends Client {
  isSelected?: boolean | 'true';
  timestamp?: number;
}

export class AppDatabase extends Dexie {
  // Tablas tipadas
  profiles!: Table<Profile, string>;
  conversations!: Table<CachedConversation, string>;
  conversationMembers!: Table<ConversationMember, string>;
  messages!: Table<CachedMessage, string>;
  reactions!: Table<MessageReaction, string>;
  typingStatus!: Table<TypingStatus, string>;
  userPresence!: Table<UserPresence, string>;
  pendingOperations!: Table<PendingOperation, string>;
  syncState!: Table<SyncState, number>; // Solo 1 registro (id = 1)
  localMessages!: Table<LocalMessage, string>;
  unauthenticatedQueue!: Table<UnauthenticatedMessageQueue, string>;

  // Tablas de la aplicación principal
  cart!: Table<CartItem, string>;
  selectedClient!: Table<SelectedClientRecord, string>;
  products!: Table<Product, string>;
  clients!: Table<Client, string>;
  sellers!: Table<Seller, string>;
  orders!: Table<Order, string>;
  drafts!: Table<DraftOrder, string>;
  sharedCarts!: Table<SharedCart, string>;
  pendingOrders!: Table<LocalPendingOrder, string>;
  settings!: Table<{ id: string; key: string; value: string; updated_at: string }, string>;

  constructor() {
    super('TecnoAppDB');

    this.version(4).stores({
      // Perfiles: indexados por id y username
      profiles: 'id, username, status, last_seen_at',

      // Conversaciones: indexados por id, last_message_at, synced_at
      conversations: 'id, type, slug, last_message_at, *synced_at, is_archived',

      // Miembros: compound index para búsquedas rápidas
      conversationMembers: '[conversation_id+user_id], conversation_id, user_id, unread_count',

      // Mensajes: compound index crítico para performance
      messages:
        'id, [conversation_id+created_at], conversation_id, user_id, parent_id, type, pending, *synced_at',

      // Reacciones: compound index para búsquedas únicas
      reactions: 'id, [message_id+user_id+emoji], [message_id+emoji], message_id, user_id',

      // Typing: expira automáticamente
      typingStatus: 'id, conversation_id, user_id, expires_at',

      // Presence: indexado por status
      userPresence: 'user_id, status, last_active_at',

      // Operaciones pendientes: ordenadas por created_at
      pendingOperations: 'id, type, created_at, retry_count',

      // Estado de sync: solo 1 registro
      syncState: '++id',

      // Mensajes locales para usuarios no autenticados
      localMessages: 'id, conversation_id, created_at, is_authenticated',

      // Cola de mensajes no autenticados
      unauthenticatedQueue: 'id, created_at',

      // Carrito: items del carrito de compras
      cart: 'id, name, price, quantity, category',

      // Cliente seleccionado: información del cliente actual
      selectedClient:
        'id, name, email, phone, address, billing_city, billing_state, cuit, isSelected',

      // App principal Data (Core)
      products: 'id, category, name',
      clients: 'id, email, phone, cuit, name',
      sellers: 'id, name',
      orders: 'id, clientId, status, createdAt, sellerId',
      drafts: 'id, status, date',
      sharedCarts: 'id, code, isActive, expiresAt',

      // Settings: UI preferences and app settings
      settings: 'id, key, updated_at',
    });

    this.version(5).stores({
      pendingOrders:
        'id, sellerId, status, createdAt, updatedAt, attemptCount, lastAttemptAt, syncedOrderId, supabaseId',
    });
  }
}

// ============================================================================
// INSTANCIA GLOBAL
// ============================================================================

export const appDB = new AppDatabase();

// ============================================================================
// HELPERS DE CONVERSACIONES
// ============================================================================

export async function saveConversations(conversations: CachedConversation[]): Promise<void> {
  const withSyncTime = conversations.map((c) => ({
    ...c,
    synced_at: new Date().toISOString(),
  }));
  await appDB.conversations.bulkPut(withSyncTime);
}

export async function getConversations(
  options: { archived?: boolean; limit?: number; offset?: number } = {},
): Promise<CachedConversation[]> {
  let collection = appDB.conversations.orderBy('last_message_at').reverse();

  if (options.archived !== undefined) {
    collection = collection.filter((c) => c.is_archived === options.archived);
  }

  if (options.offset) {
    collection = collection.offset(options.offset);
  }

  if (options.limit) {
    collection = collection.limit(options.limit);
  }

  return await collection.toArray();
}

export async function getConversationById(id: string): Promise<CachedConversation | undefined> {
  return await appDB.conversations.get(id);
}

export async function updateConversation(
  id: string,
  updates: Partial<CachedConversation>,
): Promise<void> {
  await appDB.conversations.update(id, {
    ...updates,
    synced_at: new Date().toISOString(),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await appDB.conversations.delete(id);
  // Limpiar mensajes relacionados
  await appDB.messages.where({ conversation_id: id }).delete();
}

// ============================================================================
// HELPERS DE MENSAJES
// ============================================================================

export async function saveMessages(
  messages: CachedMessage[],
  options: {
    conversationId: string;
    prepend?: boolean; // true = mensajes antiguos, false = nuevos
  },
): Promise<void> {
  const withSyncTime = messages.map((m) => ({
    ...m,
    synced_at: new Date().toISOString(),
  }));

  await appDB.messages.bulkPut(withSyncTime);

  // Actualizar last_message_at de la conversación si es mensaje nuevo
  if (!options.prepend && messages.length > 0) {
    const latest = messages.reduce((latest, m) => (m.created_at > latest.created_at ? m : latest));

    await appDB.conversations.update(options.conversationId, {
      last_message_at: latest.created_at,
    });
  }
}

export async function getMessages(
  conversationId: string,
  options: {
    before?: string; // ISO date string
    after?: string;
    limit?: number;
    includePending?: boolean;
  } = {},
): Promise<CachedMessage[]> {
  let query = appDB.messages.where({ conversation_id: conversationId });

  // Filtrar por rango de fechas
  if (options.before && options.after) {
    query = appDB.messages
      .where('[conversation_id+created_at]')
      .between([conversationId, options.after], [conversationId, options.before], true, true);
  } else if (options.before) {
    query = appDB.messages
      .where('[conversation_id+created_at]')
      .between([conversationId, ''], [conversationId, options.before], true, true);
  } else if (options.after) {
    query = appDB.messages
      .where('[conversation_id+created_at]')
      .above([conversationId, options.after]);
  }

  let collection = query.sortBy('created_at');

  // Excluir mensajes pendientes si se solicita
  if (!options.includePending) {
    collection = collection.then((msgs) => msgs.filter((m) => !m.pending));
  }

  if (options.limit) {
    collection = collection.then((msgs) => msgs.slice(-options.limit!));
  }

  return collection;
}

export async function getMessageById(id: string): Promise<CachedMessage | undefined> {
  return await appDB.messages.get(id);
}

export async function savePendingMessage(
  message: Omit<CachedMessage, 'id' | 'synced_at'>,
): Promise<string> {
  const id = crypto.randomUUID();
  const pendingMessage: CachedMessage = {
    ...(message as CachedMessage),
    id,
    pending: true,
    synced_at: new Date().toISOString(),
  };
  await appDB.messages.add(pendingMessage);
  return id;
}

export async function markMessageAsSent(tempId: string, realMessage: Message): Promise<void> {
  await appDB.messages.delete(tempId);
  await appDB.messages.add({
    ...realMessage,
    synced_at: new Date().toISOString(),
  });
}

export async function markMessageAsFailed(id: string, error: string): Promise<void> {
  await appDB.messages.update(id, {
    pending: false,
    error,
  });
}

export async function deleteMessage(id: string): Promise<void> {
  await appDB.messages.delete(id);
}

export async function clearOldMessages(
  conversationId: string,
  keepCount: number = 500,
): Promise<number> {
  const messages = await appDB.messages
    .where({ conversation_id: conversationId })
    .sortBy('created_at');

  if (messages.length <= keepCount) return 0;

  const toDelete = messages.slice(0, messages.length - keepCount);
  const ids = toDelete.map((m) => m.id);

  await appDB.messages.bulkDelete(ids);
  return toDelete.length;
}

// ============================================================================
// HELPERS DE REACCIONES
// ============================================================================

export async function saveReactions(reactions: MessageReaction[]): Promise<void> {
  await appDB.reactions.bulkPut(reactions);
}

export async function addReaction(
  reaction: Omit<MessageReaction, 'id' | 'created_at'>,
): Promise<void> {
  // Validar que los campos requeridos existan
  if (!reaction.message_id || !reaction.user_id || !reaction.emoji) {
    console.error('[addReaction] Invalid reaction data:', reaction);
    return;
  }

  const existing = await appDB.reactions
    .where('[message_id+user_id+emoji]')
    .equals([reaction.message_id, reaction.user_id, reaction.emoji])
    .first();

  if (!existing) {
    await appDB.reactions.add({
      ...reaction,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
  }
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  // Validar que los campos requeridos existan
  if (!messageId || !userId || !emoji) {
    console.error('[removeReaction] Invalid parameters:', { messageId, userId, emoji });
    return;
  }

  const reaction = await appDB.reactions
    .where('[message_id+user_id+emoji]')
    .equals([messageId, userId, emoji])
    .first();

  if (reaction) {
    await appDB.reactions.delete(reaction.id);
  }
}

export async function getReactionsForMessage(messageId: string): Promise<MessageReaction[]> {
  return await appDB.reactions.where({ message_id: messageId }).toArray();
}

// ============================================================================
// HELPERS DE PROFILES
// ============================================================================

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  await appDB.profiles.bulkPut(profiles);
}

export async function getProfile(userId: string): Promise<Profile | undefined> {
  return await appDB.profiles.get(userId);
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  await appDB.profiles.update(userId, updates);
}

// ============================================================================
// HELPERS DE TYPING STATUS
// ============================================================================

export async function setTypingStatus(
  status: Omit<TypingStatus, 'id' | 'started_at'>,
): Promise<void> {
  const existing = await appDB.typingStatus
    .where({ conversation_id: status.conversation_id, user_id: status.user_id })
    .first();

  const now = new Date();
  const newStatus: TypingStatus = {
    ...status,
    id: existing?.id || crypto.randomUUID(),
    started_at: now.toISOString(),
  };

  await appDB.typingStatus.put(newStatus);
}

export async function clearTypingStatus(conversationId: string, userId: string): Promise<void> {
  const existing = await appDB.typingStatus
    .where({ conversation_id: conversationId, user_id: userId })
    .first();

  if (existing) {
    await appDB.typingStatus.delete(existing.id);
  }
}

export async function getTypingUsers(
  conversationId: string,
  currentUserId: string,
): Promise<TypingStatus[]> {
  const now = new Date().toISOString();
  return await appDB.typingStatus
    .where({ conversation_id: conversationId })
    .filter((t) => t.user_id !== currentUserId && t.expires_at > now)
    .toArray();
}

export async function cleanupExpiredTyping(): Promise<number> {
  const now = new Date().toISOString();
  const expired = await appDB.typingStatus.where('expires_at').below(now).toArray();

  const ids = expired.map((t) => t.id);
  await appDB.typingStatus.bulkDelete(ids);
  return expired.length;
}

// ============================================================================
// HELPERS DE PRESENCE
// ============================================================================

export async function savePresence(presence: UserPresence): Promise<void> {
  await appDB.userPresence.put(presence);
}

export async function getPresence(userId: string): Promise<UserPresence | undefined> {
  return await appDB.userPresence.get(userId);
}

export async function getOnlineUsers(): Promise<string[]> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const online = await appDB.userPresence.where('last_active_at').above(fiveMinutesAgo).toArray();
  return online.map((p) => p.user_id);
}

// ============================================================================
// HELPERS DE SYNC STATE
// ============================================================================

export async function getSyncState(): Promise<SyncState | undefined> {
  return await appDB.syncState.get(1);
}

export async function saveSyncState(updates: Partial<SyncState>): Promise<void> {
  const existing = await appDB.syncState.get(1);
  const state: SyncState & { id?: number } = {
    last_sync_at: new Date().toISOString(),
    conversations_synced: [],
    pending_operations: [],
    is_online: navigator.onLine,
    ...existing,
    ...updates,
    id: 1,
  };
  await appDB.syncState.put(state);
}

export async function markConversationAsSynced(conversationId: string): Promise<void> {
  const state = await getSyncState();
  const synced = new Set(state?.conversations_synced || []);
  synced.add(conversationId);
  await saveSyncState({
    conversations_synced: Array.from(synced),
  });
}

// ============================================================================
// HELPERS DE PENDING OPERATIONS (COLA OFFLINE)
// ============================================================================

export async function addPendingOperation(
  operation: Omit<PendingOperation, 'id' | 'created_at'>,
): Promise<string> {
  const id = crypto.randomUUID();
  const pendingOp: PendingOperation = {
    ...(operation as PendingOperation),
    id,
    created_at: new Date().toISOString(),
  };
  await appDB.pendingOperations.add(pendingOp);
  return id;
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  return await appDB.pendingOperations.orderBy('created_at').toArray();
}

export async function removePendingOperation(id: string): Promise<void> {
  await appDB.pendingOperations.delete(id);
}

export async function incrementRetryCount(id: string): Promise<void> {
  const op = await appDB.pendingOperations.get(id);
  if (op) {
    await appDB.pendingOperations.update(id, {
      retry_count: op.retry_count + 1,
    });
  }
}

export async function clearPendingOperations(): Promise<void> {
  await appDB.pendingOperations.clear();
}

// ============================================================================
// UTILIDADES DE DATABASE
// ============================================================================

export async function clearAllData(): Promise<void> {
  await appDB.delete();
}

export async function exportData(): Promise<{
  conversations: CachedConversation[];
  messages: CachedMessage[];
  profiles: Profile[];
}> {
  const [conversations, messages, profiles] = await Promise.all([
    appDB.conversations.toArray(),
    appDB.messages.toArray(),
    appDB.profiles.toArray(),
  ]);

  return { conversations, messages, profiles };
}

export async function getDatabaseSize(): Promise<{
  conversations: number;
  messages: number;
  totalBytes: number;
}> {
  const conversations = await appDB.conversations.count();
  const messages = await appDB.messages.count();

  // Estimación aproximada (no es 100% precisa pero útil)
  const convBytes = conversations * 500; // ~500 bytes por conversación
  const msgBytes = messages * 1000; // ~1KB por mensaje

  return {
    conversations,
    messages,
    totalBytes: convBytes + msgBytes,
  };
}

export async function vacuumDatabase(): Promise<void> {
  // Limpiar mensajes antiguos de todas las conversaciones
  const conversations = await appDB.conversations.toArray();
  let deletedCount = 0;

  for (const conv of conversations) {
    deletedCount += await clearOldMessages(conv.id, 1000);
  }

  // Limpiar typing expirados
  await cleanupExpiredTyping();

  // Limpiar operaciones pendientes muy antiguas (>24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oldOps = await appDB.pendingOperations.where('created_at').below(oneDayAgo).toArray();
  await appDB.pendingOperations.bulkDelete(oldOps.map((o) => o.id));

  // Limpiar mensajes locales no autenticados antiguos (>7 días)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oldLocalMessages = await appDB.localMessages
    .where('created_at')
    .below(sevenDaysAgo)
    .toArray();
  await appDB.localMessages.bulkDelete(oldLocalMessages.map((m) => m.id));

  console.log(
    `[ChatDB] Vacuumed ${deletedCount} old messages and ${oldLocalMessages.length} local messages`,
  );
}

// ============================================================================
// HELPERS DE MENSAJES LOCALES (USUARIOS NO AUTENTICADOS)
// ============================================================================

export async function saveLocalMessage(message: Omit<LocalMessage, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  const localMessage: LocalMessage = {
    ...message,
    id,
  };
  await appDB.localMessages.add(localMessage);

  // Actualizar o crear la cola de mensajes no autenticados
  await updateUnauthenticatedQueue(message.conversation_id, localMessage);

  return id;
}

export async function getLocalMessages(conversationId: string): Promise<LocalMessage[]> {
  return await appDB.localMessages.where({ conversation_id: conversationId }).sortBy('created_at');
}

export async function updateUnauthenticatedQueue(
  conversationId: string,
  message: LocalMessage,
): Promise<void> {
  const queueId = 'unauthenticated_queue';

  const existingQueue = await appDB.unauthenticatedQueue.get(queueId);

  if (existingQueue) {
    // Agregar mensaje a la cola existente
    const updatedQueue: UnauthenticatedMessageQueue = {
      ...existingQueue,
      messages: [...existingQueue.messages, message],
    };
    await appDB.unauthenticatedQueue.put(updatedQueue);
  } else {
    // Crear nueva cola
    const newQueue: UnauthenticatedMessageQueue = {
      id: queueId,
      messages: [message],
      created_at: new Date().toISOString(),
    };
    await appDB.unauthenticatedQueue.add(newQueue);
  }
}

export async function getUnauthenticatedQueue(): Promise<UnauthenticatedMessageQueue | undefined> {
  return await appDB.unauthenticatedQueue.get('unauthenticated_queue');
}

export async function clearUnauthenticatedQueue(): Promise<void> {
  await appDB.unauthenticatedQueue.delete('unauthenticated_queue');
  await appDB.localMessages.clear();
}

export async function syncQueuedMessages(
  userId: string,
  conversationId: string,
): Promise<LocalMessage[]> {
  const queue = await getUnauthenticatedQueue();
  if (!queue) return [];

  // Filtrar mensajes de esta conversación que no estén autenticados
  const messagesToSync = queue.messages.filter(
    (msg) => msg.conversation_id === conversationId && !msg.is_authenticated,
  );

  // Marcar mensajes como autenticados
  for (const message of messagesToSync) {
    await appDB.localMessages.update(message.id, {
      is_authenticated: true,
    });
  }

  // Actualizar la cola
  const remainingMessages = queue.messages.filter(
    (msg) => !(msg.conversation_id === conversationId && !msg.is_authenticated),
  );

  if (remainingMessages.length === 0) {
    await clearUnauthenticatedQueue();
  } else {
    await appDB.unauthenticatedQueue.update('unauthenticated_queue', {
      messages: remainingMessages,
    });
  }

  return messagesToSync;
}

// ============================================================================
// HELPERS DE SETTINGS (UI PREFERENCES)
// ============================================================================

export async function saveSetting(key: string, value: string): Promise<void> {
  const setting = {
    id: key,
    key,
    value,
    updated_at: new Date().toISOString(),
  };
  await appDB.settings.put(setting);
}

export async function getSetting(key: string): Promise<string | undefined> {
  const setting = await appDB.settings.get(key);
  return setting?.value;
}

export async function getPrimaryColor(): Promise<string> {
  const color = await getSetting('primaryColor');
  return color || '#0A5DFF'; // Default color
}

export async function savePrimaryColor(color: string): Promise<void> {
  await saveSetting('primaryColor', color);
}
