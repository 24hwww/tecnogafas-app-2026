// ============================================================================
// HOOK: useMessages
// Manejo de mensajes con realtime + offline-first
// ============================================================================

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addPendingOperation,
  deleteMessage,
  getLocalMessages,
  getMessages,
  getProfile,
  markMessageAsFailed,
  markMessageAsSent,
  saveLocalMessage,
  saveMessages,
  savePendingMessage,
  saveProfiles,
  syncQueuedMessages,
} from '../../../stores/appDatabase';
import { channelManager, supabase } from '../lib/supabase';
import type {
  Attachment,
  CachedMessage,
  LocalMessage,
  Message,
  MessageWithAuthor,
  MessageType,
  SendMessageInput,
  UpdateMessageInput,
} from '../types';
import { UserStatus } from '../types';

const MESSAGES_PER_PAGE = 50;

interface UseMessagesOptions {
  conversationId: string | null;
  currentUserId: string | null;
}

interface UseMessagesReturn {
  messages: MessageWithAuthor[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  sendMessage: (input: Omit<SendMessageInput, 'conversation_id'>) => Promise<void>;
  updateMessage: (messageId: string, input: UpdateMessageInput) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMessages({
  conversationId,
  currentUserId,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<MessageWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cursorRef = useRef<string | null>(null);
  const isMounted = useRef(true);

  // ============================================================================
  // CARGAR MENSAJES INICIALES (CACHE + SERVER)
  // ============================================================================

  const loadMessages = useCallback(
    async (loadMore = false) => {
      if (!conversationId) return;

      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        // 1. Cargar desde cache primero (instantáneo)
        const cached = await getMessages(conversationId, {
          before: loadMore ? cursorRef.current || undefined : undefined,
          limit: MESSAGES_PER_PAGE,
          includePending: true,
        });

        // 2. Cargar mensajes locales de usuarios no autenticados
        const localMessages = await getLocalMessages(conversationId);

        // Combinar mensajes cache y locales
        const allMessages = [...cached, ...localMessages];

        // Enriquecer con perfiles del cache
        const enriched = await enrichMessagesWithAuthors(allMessages);

        if (!loadMore) {
          setMessages(enriched.reverse()); // Más nuevo al final
        } else {
          setMessages((prev) => [...enriched.reverse(), ...prev]);
        }

        // 2. Fetch desde servidor
        let query = supabase
          .from('messages')
          .select(`
          *,
          author:profiles!messages_user_id_fkey(*)
        `)
          .eq('conversation_id', conversationId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(MESSAGES_PER_PAGE);

        if (loadMore && cursorRef.current) {
          query = query.lt('created_at', cursorRef.current);
        }

        const { data: serverMessages, error: serverError } = await query;

        if (serverError) throw serverError;

        if (serverMessages && serverMessages.length > 0) {
          // Guardar en cache
          const typed = serverMessages as unknown as MessageWithAuthor[];
          await saveMessages(typed as CachedMessage[], {
            conversationId,
            prepend: loadMore,
          });

          // Guardar perfiles
          const profiles = typed
            .map((m) => m.author)
            .filter((p): p is NonNullable<typeof p> => !!p);
          await saveProfiles(profiles);

          // Actualizar UI
          if (!loadMore) {
            setMessages(typed.reverse());
          } else {
            setMessages((prev) => {
              const merged = mergeMessages(typed.reverse(), prev);
              return merged;
            });
          }

          // Actualizar cursor
          const oldest = serverMessages[serverMessages.length - 1] as { created_at: string };
          cursorRef.current = oldest.created_at;
          setHasMore(serverMessages.length === MESSAGES_PER_PAGE);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (loadMore) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [conversationId],
  );

  // ============================================================================
  // ENRIQUECER MENSAJES CON AUTORES
  // ============================================================================

  const enrichMessagesWithAuthors = async (msgs: Message[]): Promise<MessageWithAuthor[]> => {
    const userIds = [...new Set(msgs.map((m) => m.user_id).filter(Boolean))];
    const profiles = await Promise.all(userIds.map((id) => getProfile(id as string)));
    const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p!]));

    return msgs.map((m) => {
      // Handle guest users (local messages)
      if (!m.user_id) {
        return {
          ...m,
          author: {
            id: 'guest',
            username: 'invitado',
            display_name: 'Invitado',
            avatar_url: null,
            status: UserStatus.OFFLINE,
            status_message: null,
            last_seen_at: m.created_at,
            metadata: {},
            created_at: m.created_at,
            updated_at: m.updated_at,
          },
        };
      }
      
      return {
        ...m,
        author: profileMap.get(m.user_id),
      };
    });
  };

  // ============================================================================
  // MERGE DE MENSAJES (evitar duplicados)
  // ============================================================================

  const mergeMessages = (
    newMsgs: MessageWithAuthor[],
    existing: MessageWithAuthor[],
  ): MessageWithAuthor[] => {
    const seen = new Set(existing.map((m) => m.id));
    const unique = newMsgs.filter((m) => !seen.has(m.id));
    return [...unique, ...existing];
  };

  // ============================================================================
  // ENVIAR MENSAJE (optimistic + offline queue)
  // ============================================================================

  const sendMessage = useCallback(
    async (input: Omit<SendMessageInput, 'conversation_id'>) => {
      if (!conversationId) {
        throw new Error('No active conversation');
      }

      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Si no hay usuario autenticado, guardar localmente
      if (!currentUserId) {
        const localMessage: Omit<LocalMessage, 'id'> = {
          conversation_id: conversationId,
          content: input.content,
          type: (input.type || 'text') as MessageType,
          metadata: input.metadata || {},
          attachments: (input.attachments || []) as Omit<Attachment, 'id'>[],
          created_at: now,
          is_authenticated: false,
          user_display_name: 'Invitado',
        };

        const messageId = await saveLocalMessage(localMessage);
        
        // Agregar a la UI inmediatamente
        const messageWithAuthor: MessageWithAuthor = {
          id: messageId,
          conversation_id: localMessage.conversation_id,
          parent_id: input.parent_id || null,
          user_id: null,
          type: localMessage.type,
          content: localMessage.content,
          content_html: null,
          metadata: localMessage.metadata,
          order_data: null,
          alert_data: null,
          attachments: localMessage.attachments.map(att => ({
            ...att,
            id: crypto.randomUUID(),
          })),
          reply_count: 0,
          reaction_count: 0,
          is_edited: false,
          is_deleted: false,
          edited_at: null,
          deleted_at: null,
          deleted_by: null,
          created_at: now,
          updated_at: now,
          pending: false,
          author: {
            id: 'guest',
            username: 'invitado',
            display_name: 'Invitado',
            avatar_url: null,
            status: UserStatus.OFFLINE,
            status_message: null,
            last_seen_at: now,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        };

        setMessages((prev) => [...prev, messageWithAuthor]);
        return;
      }

      // 1. Crear mensaje optimista para usuarios autenticados
      const optimisticMessage: MessageWithAuthor = {
        id: tempId,
        conversation_id: conversationId,
        parent_id: input.parent_id || null,
        user_id: currentUserId,
        type: (input.type || 'text') as Message['type'],
        content: input.content,
        content_html: null,
        metadata: input.metadata || {},
        order_data: null,
        alert_data: null,
        attachments: (input.attachments || []) as Message['attachments'],
        reply_count: 0,
        reaction_count: 0,
        is_edited: false,
        is_deleted: false,
        edited_at: null,
        deleted_at: null,
        deleted_by: null,
        created_at: now,
        updated_at: now,
        pending: true,
      };

      // 2. Guardar en cache (UI instantánea)
      await savePendingMessage(optimisticMessage);
      setMessages((prev) => [...prev, optimisticMessage]);

      // 3. Si offline, agregar a cola
      if (!navigator.onLine) {
        await addPendingOperation({
          type: 'send_message',
          payload: {
            conversation_id: conversationId,
            parent_id: input.parent_id,
            content: input.content,
            type: input.type,
            metadata: input.metadata,
            attachments: input.attachments,
            temp_id: tempId,
          },
          retry_count: 0,
        });
        return;
      }

      // 4. Enviar a Supabase
      try {
        const { data, error } = await (supabase as any)
          .from('messages')
          .insert({
            conversation_id: conversationId,
            parent_id: input.parent_id,
            type: (input.type || 'text') as Message['type'],
            content: input.content,
            metadata: input.metadata,
            attachments: input.attachments,
          })
          .select(`
            *,
            author:profiles!messages_user_id_fkey(*)
          `)
          .single();

        if (error) throw error;

        // 5. Reemplazar mensaje temporal con el real
        await markMessageAsSent(tempId, data as Message);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (data as MessageWithAuthor) : m)));
      } catch (err) {
        // Marcar como fallido
        await markMessageAsFailed(tempId, err instanceof Error ? err.message : 'Failed to send');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, pending: false, error: 'Failed to send' } : m,
          ),
        );
        throw err;
      }
    },
    [conversationId, currentUserId],
  );

  // ============================================================================
  // ACTUALIZAR MENSAJE
  // ============================================================================

  const updateMessage = useCallback(
    async (messageId: string, input: UpdateMessageInput) => {
      if (!conversationId) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: input.content, is_edited: true } : m,
        ),
      );

      try {
        const { error } = await (supabase as any)
          .from('messages')
          .update({
            content: input.content,
            is_edited: true,
            edited_at: new Date().toISOString(),
          })
          .eq('id', messageId);

        if (error) throw error;
      } catch (err) {
        // Revert on error (recargar mensajes)
        await loadMessages();
        throw err;
      }
    },
    [conversationId, loadMessages],
  );

  // ============================================================================
  // ELIMINAR MENSAJE
  // ============================================================================

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;

      // Optimistic delete
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        const { error } = await (supabase as any)
          .from('messages')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', messageId);

        if (error) throw error;

        await deleteMessage(messageId);
      } catch (err) {
        // Revert on error
        await loadMessages();
        throw err;
      }
    },
    [conversationId, loadMessages],
  );

  // ============================================================================
  // REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `messages:${conversationId}`;

    const setupSubscription = async () => {
      const channel = channelManager.getChannel(channelName);

      // @ts-expect-error
      if (channel.state === 'closed' || channel.state === 'errored') {
        channel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload: RealtimePostgresChangesPayload<Message>) => {
              const newMessage = payload.new as Message;

              // No duplicar si ya existe (nuestro propio mensaje)
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) return prev;

                // Enriquecer con autor
                return [...prev, { ...newMessage, author: undefined }];
              });

              // Cargar autor completo
              const { data: author } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newMessage.user_id)
                .single();

              if (author) {
                await saveProfiles([author]);
                setMessages((prev) =>
                  prev.map((m) => (m.id === newMessage.id ? { ...m, author } : m)),
                );
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload: RealtimePostgresChangesPayload<Message>) => {
              const updated = payload.new as Message;

              setMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
              );
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload: RealtimePostgresChangesPayload<Message>) => {
              const deleted = payload.old as Message;
              setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
            },
          );
      }

      await channelManager.subscribe(channelName, {
        onError: (err) => {
          console.error('[Realtime] Messages subscription error:', err);
        },
      });
    };

    setupSubscription();

    return () => {
      channelManager.unsubscribe(channelName);
    };
  }, [conversationId]);

  // ============================================================================
  // SINCRONIZAR MENSAJES EN COLA CUANDO USUARIO SE AUTENTICA
  // ============================================================================

  const syncQueuedMessagesOnAuth = useCallback(async () => {
    if (!currentUserId || !conversationId) return;

    try {
      const queuedMessages = await syncQueuedMessages(currentUserId, conversationId);
      
      // Enviar mensajes encolados a Supabase
      for (const queuedMessage of queuedMessages) {
        try {
          const { data, error } = await (supabase as any)
            .from('messages')
            .insert({
              conversation_id: queuedMessage.conversation_id,
              type: queuedMessage.type,
              content: queuedMessage.content,
              metadata: queuedMessage.metadata,
              attachments: queuedMessage.attachments,
            })
            .select(`
              *,
              author:profiles!messages_user_id_fkey(*)
            `)
            .single();

          if (error) throw error;

          // Reemplazar mensaje local con el real en la UI
          setMessages((prev) => 
            prev.map((m) => 
              m.id === queuedMessage.id ? (data as MessageWithAuthor) : m
            )
          );
        } catch (err) {
          console.error('[Chat] Failed to sync queued message:', err);
        }
      }
    } catch (err) {
      console.error('[Chat] Failed to sync queued messages:', err);
    }
  }, [currentUserId, conversationId]);

  // ============================================================================
  // CARGA INICIAL
  // ============================================================================

  useEffect(() => {
    if (conversationId) {
      cursorRef.current = null;
      setHasMore(true);
      loadMessages(false);
    } else {
      setMessages([]);
      setIsLoading(false);
    }

    return () => {
      isMounted.current = false;
    };
  }, [conversationId, loadMessages]);

  // Sincronizar mensajes cuando el usuario se autentica
  useEffect(() => {
    if (currentUserId && conversationId) {
      syncQueuedMessagesOnAuth();
    }
  }, [currentUserId, conversationId, syncQueuedMessagesOnAuth]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    sendMessage,
    updateMessage,
    deleteMessage: handleDeleteMessage,
    loadMore: () => loadMessages(true),
    refresh: () => loadMessages(false),
  };
}
