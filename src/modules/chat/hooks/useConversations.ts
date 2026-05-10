// ============================================================================
// HOOK: useConversations
// Manejo de conversaciones con realtime
// ============================================================================

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import {
  getConversations,
  saveConversations,
  updateConversation,
} from '../../../stores/appDatabase';
import { channelManager, supabase } from '../lib/supabase';
import type {
  Conversation,
  ConversationMember,
  ConversationWithDetails,
  CreateConversationInput,
  MemberRole,
} from '../types';

interface UseConversationsReturn {
  conversations: ConversationWithDetails[];
  isLoading: boolean;
  error: Error | null;
  createConversation: (input: CreateConversationInput) => Promise<Conversation>;
  joinConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  pinConversation: (conversationId: string, pinned: boolean) => Promise<void>;
  muteConversation: (conversationId: string, muted: boolean) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useConversations(currentUserId: string | null): UseConversationsReturn {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ============================================================================
  // CARGAR CONVERSACIONES
  // ============================================================================

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Cargar desde cache primero
      const cached = await getConversations({ archived: false });
      if (cached.length > 0) {
        setConversations(cached as ConversationWithDetails[]);
      }

      // 2. Fetch desde servidor - diferente para usuarios autenticados vs no autenticados
      let serverConvs, serverError;

      if (currentUserId) {
        // Usuario autenticado: cargar sus conversaciones
        const result = await supabase
          .from('conversation_members')
          .select(`
            *,
            conversation:conversations(*)
          `)
          .eq('user_id', currentUserId)
          .order('updated_at', { foreignTable: 'conversations', ascending: false });
        serverConvs = result.data;
        serverError = result.error;
      } else {
        // Usuario no autenticado: cargar solo conversaciones públicas
        const result = await supabase
          .from('conversations')
          .select('*')
          .eq('is_private', false)
          .order('updated_at', { ascending: false });
        serverConvs = result.data;
        serverError = result.error;
      }

      if (serverError) throw serverError;

      let formatted: ConversationWithDetails[] = [];

      if (serverConvs && serverConvs.length > 0) {
        if (currentUserId) {
          // Usuario autenticado: formatear desde conversation_members
          formatted = (
            serverConvs as unknown as Array<{
              conversation: Conversation;
              unread_count: number;
              last_read_at: string;
              role: ConversationMember['role'];
              is_muted: boolean;
              is_pinned: boolean;
            }>
          ).map((cm) => ({
            ...cm.conversation,
            member: cm as unknown as ConversationMember,
            unread_count: cm.unread_count,
            last_read_at: cm.last_read_at,
            user_role: cm.role,
            is_muted: cm.is_muted,
            is_pinned: cm.is_pinned,
          }));
        } else {
          // Usuario no autenticado: formatear directamente desde conversations
          formatted = (serverConvs as Conversation[]).map((conv) => ({
            ...conv,
            member: {
              id: 'guest',
              conversation_id: conv.id,
              user_id: 'guest',
              role: 'member' as MemberRole,
              joined_at: new Date().toISOString(),
              last_read_at: new Date().toISOString(),
              unread_count: 0,
              is_muted: false,
              is_pinned: false,
              notifications: { all: true, mentions: true, replies: true },
              metadata: {},
              created_at: conv.created_at,
              updated_at: conv.updated_at,
            },
            unread_count: 0,
            last_read_at: new Date().toISOString(),
            user_role: 'member' as MemberRole,
            is_muted: false,
            is_pinned: false,
          }));
        }
      }

      // 3. Para usuarios autenticados, asegurar canal #notificaciones público
      if (currentUserId) {
        const hasNotif = formatted.some((c) => c.slug === 'notificaciones');
        if (!hasNotif) {
          try {
            const { data: notifConv } = await supabase
              .from('conversations')
              .select('id')
              .eq('slug', 'notificaciones')
              .maybeSingle();

            if (notifConv) {
              await supabase.from('conversation_members').insert([
                {
                  conversation_id: (notifConv as { id: string }).id,
                  user_id: currentUserId,
                },
              ] as unknown as never[]);
            } else {
              const { data: newConv } = await supabase
                .from('conversations')
                .insert([
                  {
                    type: 'channel',
                    name: 'Notificaciones',
                    slug: 'notificaciones',
                    description: 'Canal de notificaciones del sistema',
                    is_private: false,
                    created_by: currentUserId,
                  },
                ] as unknown as never[])
                .select()
                .single();

              if (newConv) {
                await supabase.from('conversation_members').insert([
                  {
                    conversation_id: (newConv as { id: string }).id,
                    user_id: currentUserId,
                    role: 'owner' as MemberRole,
                  },
                ] as unknown as never[]);
              }
            }

            // Recargar conversaciones tras unirse/crear
            const { data: reloaded } = await supabase
              .from('conversation_members')
              .select(`*, conversation:conversations(*)`)
              .eq('user_id', currentUserId)
              .order('updated_at', { foreignTable: 'conversations', ascending: false });

            if (reloaded && reloaded.length > 0) {
              formatted = (
                reloaded as unknown as Array<{
                  conversation: Conversation;
                  unread_count: number;
                  last_read_at: string;
                  role: ConversationMember['role'];
                  is_muted: boolean;
                  is_pinned: boolean;
                }>
              ).map((cm) => ({
                ...cm.conversation,
                member: cm as unknown as ConversationMember,
                unread_count: cm.unread_count,
                last_read_at: cm.last_read_at,
                user_role: cm.role,
                is_muted: cm.is_muted,
                is_pinned: cm.is_pinned,
              }));
            }
          } catch (ensureErr) {
            console.error('Error ensuring notifications channel:', ensureErr);
          }
        }
      }

      // Guardar en cache y actualizar UI
      if (formatted.length > 0) {
        await saveConversations(formatted as CachedConversation[]);
        setConversations(formatted);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // ============================================================================
  // CREAR CONVERSACIÓN
  // ============================================================================

  const createConversation = useCallback(
    async (input: CreateConversationInput): Promise<Conversation> => {
      if (!currentUserId) throw new Error('No user');

      // Crear conversación
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert([
          {
            type: input.type,
            name: input.name,
            description: input.description,
            slug: input.slug,
            is_private: input.is_private,
            created_by: currentUserId,
            metadata: input.metadata,
          },
        ] as unknown as never[])
        .select()
        .single();

      if (convError || !conv) throw convError || new Error('Failed to create');

      // Agregar creador como owner
      const members = [currentUserId, ...(input.member_ids || [])];
      const uniqueMembers = [...new Set(members)];

      const { error: membersError } = await supabase.from('conversation_members').insert(
        uniqueMembers.map((userId, idx) => ({
          conversation_id: (conv as { id: string }).id,
          user_id: userId,
          role: (idx === 0 ? 'owner' : 'member') as MemberRole,
        })) as unknown as never[],
      );

      if (membersError) {
        // Rollback: eliminar conversación
        await supabase
          .from('conversations')
          .delete()
          .eq('id', (conv as { id: string }).id);
        throw membersError;
      }

      // Agregar a cache local
      const convWithId = conv as unknown as Conversation;
      const withDetails: ConversationWithDetails = {
        ...convWithId,
        member: {
          id: '',
          conversation_id: convWithId.id,
          user_id: currentUserId,
          role: 'owner' as MemberRole,
          joined_at: new Date().toISOString(),
          last_read_at: new Date().toISOString(),
          unread_count: 0,
          is_muted: false,
          is_pinned: false,
          notifications: { all: true, mentions: true, replies: true },
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        unread_count: 0,
        last_read_at: new Date().toISOString(),
        user_role: 'owner' as MemberRole,
        is_muted: false,
        is_pinned: false,
      };

      setConversations((prev) => [withDetails, ...prev]);
      return conv as unknown as Conversation;
    },
    [currentUserId],
  );

  // ============================================================================
  // UNIRSE A CONVERSACIÓN
  // ============================================================================

  const joinConversation = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;

      const { error } = await supabase.from('conversation_members').insert([
        {
          conversation_id: conversationId,
          user_id: currentUserId,
        },
      ] as unknown as never[]);

      if (error) throw error;

      // Recargar conversaciones
      await loadConversations();
    },
    [currentUserId, loadConversations],
  );

  // ============================================================================
  // SALIR DE CONVERSACIÓN
  // ============================================================================

  const leaveConversation = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    },
    [currentUserId],
  );

  // ============================================================================
  // ARCHIVAR CONVERSACIÓN
  // ============================================================================

  const archiveConversation = useCallback(async (conversationId: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ is_archived: true } as unknown as never)
      .eq('id', conversationId);

    if (error) throw error;

    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
  }, []);

  // ============================================================================
  // FIJAR/DESFIJAR CONVERSACIÓN
  // ============================================================================

  const pinConversation = useCallback(
    async (conversationId: string, pinned: boolean) => {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('conversation_members')
        .update({ is_pinned: pinned } as unknown as never)
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, is_pinned: pinned } : c)),
      );
    },
    [currentUserId],
  );

  // ============================================================================
  // SILENCIAR/ACTIVAR CONVERSACIÓN
  // ============================================================================

  const muteConversation = useCallback(
    async (conversationId: string, muted: boolean) => {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('conversation_members')
        .update({ is_muted: muted } as unknown as never)
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, is_muted: muted } : c)),
      );
    },
    [currentUserId],
  );

  // ============================================================================
  // MARCAR COMO LEÍDO
  // ============================================================================

  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('conversation_members')
        .update({
          last_read_at: now,
          unread_count: 0,
        } as unknown as never)
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0, last_read_at: now } : c,
        ),
      );
    },
    [currentUserId],
  );

  // ============================================================================
  // REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    const channelName = 'conversations';
    const channel = channelManager.getChannel(channelName);

    // Escuchar cambios en conversaciones, con guardas de seguridad
    if (channel.state === 'closed' || channel.state === 'errored') {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        async (payload: RealtimePostgresChangesPayload<Conversation>) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setConversations((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
            );
            await updateConversation(updated.id, updated);
          }
        },
      );

      // Solo para usuarios autenticados: escuchar cambios en membresías
      if (currentUserId) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_members',
            filter: `user_id=eq.${currentUserId}`,
          },
          async () => {
            // Recargar cuando cambie mi membresía
            await loadConversations();
          },
        );
      }
    }

    channelManager.subscribe(channelName, {
      onError: (err) => {
        console.error('[Realtime] Conversations error:', err);
      },
    });

    return () => {
      channelManager.unsubscribe(channelName);
    };
  }, [currentUserId, loadConversations]);

  // ============================================================================
  // CARGA INICIAL
  // ============================================================================

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    joinConversation,
    leaveConversation,
    archiveConversation,
    pinConversation,
    muteConversation,
    markAsRead,
    refresh: loadConversations,
  };
}

// Type import helper
import type { CachedConversation } from '../types';
