// ============================================================================
// HOOK: useMessages
// Manejo de mensajes con realtime + offline-first
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase, channelManager } from '../lib/supabase';
import type {
  Message,
  MessageWithAuthor,
  SendMessageInput,
  UpdateMessageInput,
  CachedMessage,
} from '../types';
import {
  getMessages,
  saveMessages,
  savePendingMessage,
  markMessageAsSent,
  markMessageAsFailed,
  deleteMessage,
  addPendingOperation,
  getProfile,
  saveProfiles,
} from '../stores/chatDatabase';

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

  const loadMessages = useCallback(async (loadMore = false) => {
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

      // Enriquecer con perfiles del cache
      const enriched = await enrichMessagesWithAuthors(cached);

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
  }, [conversationId]);

  // ============================================================================
  // ENRIQUECER MENSAJES CON AUTORES
  // ============================================================================

  const enrichMessagesWithAuthors = async (
    msgs: Message[]
  ): Promise<MessageWithAuthor[]> => {
    const userIds = [...new Set(msgs.map((m) => m.user_id).filter(Boolean))];
    const profiles = await Promise.all(
      userIds.map((id) => getProfile(id as string))
    );
    const profileMap = new Map(
      profiles.filter(Boolean).map((p) => [p!.id, p!])
    );

    return msgs.map((m) => ({
      ...m,
      author: m.user_id ? profileMap.get(m.user_id) : undefined,
    }));
  };

  // ============================================================================
  // MERGE DE MENSAJES (evitar duplicados)
  // ============================================================================

  const mergeMessages = (
    newMsgs: MessageWithAuthor[],
    existing: MessageWithAuthor[]
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
      if (!conversationId || !currentUserId) {
        throw new Error('No active conversation or user');
      }

      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();

      // 1. Crear mensaje optimista
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
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data as MessageWithAuthor) : m))
        );
      } catch (err) {
        // Marcar como fallido
        await markMessageAsFailed(
          tempId,
          err instanceof Error ? err.message : 'Failed to send'
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, pending: false, error: 'Failed to send' }
              : m
          )
        );
        throw err;
      }
    },
    [conversationId, currentUserId]
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
          m.id === messageId
            ? { ...m, content: input.content, is_edited: true }
            : m
        )
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
    [conversationId, loadMessages]
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
    [conversationId, loadMessages]
  );

  // ============================================================================
  // REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `messages:${conversationId}`;

    const setupSubscription = async () => {
      const channel = channelManager.getChannel(channelName);

      // @ts-ignore
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
                  prev.map((m) =>
                    m.id === newMessage.id ? { ...m, author } : m
                  )
                );
              }
            }
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
                prev.map((m) =>
                  m.id === updated.id ? { ...m, ...updated } : m
                )
              );
            }
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
            }
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
