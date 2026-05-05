// ============================================================================
// HOOK: useReactions
// Manejo de reacciones emoji en mensajes
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase, channelManager } from '../lib/supabase';
import type { MessageReaction, ReactionGroup } from '../types';
import { getReactionsForMessage, addReaction as dbAddReaction, removeReaction as dbRemoveReaction } from '../stores/chatDatabase';

interface UseReactionsOptions {
  messageId: string | null;
  currentUserId: string | null;
}

interface UseReactionsReturn {
  reactions: ReactionGroup[];
  isLoading: boolean;
  addReaction: (emoji: string) => Promise<void>;
  removeReaction: (emoji: string) => Promise<void>;
  toggleReaction: (emoji: string) => Promise<void>;
}

export function useReactions({
  messageId,
  currentUserId,
}: UseReactionsOptions): UseReactionsReturn {
  const [reactions, setReactions] = useState<ReactionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // CARGAR REACCIONES
  // ============================================================================

  const loadReactions = useCallback(async () => {
    if (!messageId) return;

    setIsLoading(true);
    try {
      // Cargar desde cache primero
      const cached = await getReactionsForMessage(messageId);
      if (cached.length > 0) {
        setReactions(groupReactions(cached, currentUserId));
      }

      // Fetch desde servidor
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId);

      if (error) throw error;

      if (data) {
        setReactions(groupReactions(data, currentUserId));
        // Guardar en cache
        await dbAddReaction(data as MessageReaction);
      }
    } catch (err) {
      console.error('[useReactions] Error loading:', err);
    } finally {
      setIsLoading(false);
    }
  }, [messageId, currentUserId]);

  // ============================================================================
  // AGRUPAR REACCIONES POR EMOJI
  // ============================================================================

  const groupReactions = (
    reactions: MessageReaction[],
    currentUserId: string | null
  ): ReactionGroup[] => {
    const groups = new Map<string, { users: string[]; count: number }>();

    for (const r of reactions) {
      const existing = groups.get(r.emoji);
      if (existing) {
        existing.users.push(r.user_id);
        existing.count++;
      } else {
        groups.set(r.emoji, { users: [r.user_id], count: 1 });
      }
    }

    return Array.from(groups.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      users: data.users,
      me: currentUserId ? data.users.includes(currentUserId) : false,
    }));
  };

  // ============================================================================
  // AGREGAR REACCIÓN
  // ============================================================================

  const addReaction = useCallback(
    async (emoji: string) => {
      if (!messageId || !currentUserId) return;

      // Optimistic update
      setReactions((prev) => {
        const existing = prev.find((r) => r.emoji === emoji);
        if (existing) {
          return prev.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, users: [...r.users, currentUserId], me: true }
              : r
          );
        }
        return [...prev, { emoji, count: 1, users: [currentUserId], me: true }];
      });

      try {
        const { error } = await supabase.from('message_reactions').insert([{
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        }] as unknown as never[]);

        if (error) throw error;

        await dbAddReaction({
          id: crypto.randomUUID(),
          message_id: messageId,
          user_id: currentUserId,
          emoji,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        // Revert on error
        await loadReactions();
        throw err;
      }
    },
    [messageId, currentUserId, loadReactions]
  );

  // ============================================================================
  // ELIMINAR REACCIÓN
  // ============================================================================

  const removeReaction = useCallback(
    async (emoji: string) => {
      if (!messageId || !currentUserId) return;

      // Optimistic update
      setReactions((prev) => {
        return prev
          .map((r) => {
            if (r.emoji === emoji) {
              const newCount = r.count - 1;
              if (newCount <= 0) return null;
              return {
                ...r,
                count: newCount,
                users: r.users.filter((u) => u !== currentUserId),
                me: false,
              };
            }
            return r;
          })
          .filter((r): r is ReactionGroup => r !== null);
      });

      try {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', currentUserId)
          .eq('emoji', emoji);

        if (error) throw error;

        await dbRemoveReaction(messageId, currentUserId, emoji);
      } catch (err) {
        // Revert on error
        await loadReactions();
        throw err;
      }
    },
    [messageId, currentUserId, loadReactions]
  );

  // ============================================================================
  // TOGGLE REACCIÓN
  // ============================================================================

  const toggleReaction = useCallback(
    async (emoji: string) => {
      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing?.me) {
        await removeReaction(emoji);
      } else {
        await addReaction(emoji);
      }
    },
    [reactions, addReaction, removeReaction]
  );

  // ============================================================================
  // REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (!messageId) return;

    const channelName = `reactions:${messageId}`;
    const channel = channelManager.getChannel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`,
        },
        (payload: RealtimePostgresChangesPayload<MessageReaction>) => {
          const newReaction = payload.new;
          setReactions((prev) => {
            const existing = prev.find((r) => r.emoji === newReaction.emoji);
            if (existing) {
              return prev.map((r) =>
                r.emoji === newReaction.emoji
                  ? {
                      ...r,
                      count: r.count + 1,
                      users: [...r.users, newReaction.user_id],
                      me: newReaction.user_id === currentUserId ? true : r.me,
                    }
                  : r
              );
            }
            return [
              ...prev,
              {
                emoji: newReaction.emoji,
                count: 1,
                users: [newReaction.user_id],
                me: newReaction.user_id === currentUserId,
              },
            ];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`,
        },
        (payload: RealtimePostgresChangesPayload<MessageReaction>) => {
          const deleted = payload.old;
          setReactions((prev) => {
            return prev
              .map((r) => {
                if (r.emoji === deleted.emoji) {
                  const newCount = r.count - 1;
                  if (newCount <= 0) return null;
                  return {
                    ...r,
                    count: newCount,
                    users: r.users.filter((u) => u !== deleted.user_id),
                    me: deleted.user_id === currentUserId ? false : r.me,
                  };
                }
                return r;
              })
              .filter((r): r is ReactionGroup => r !== null);
          });
        }
      );

    channelManager.subscribe(channelName, {
      onError: (err) => {
        console.error('[Realtime] Reactions error:', err);
      },
    });

    return () => {
      channelManager.unsubscribe(channelName);
    };
  }, [messageId, currentUserId]);

  // ============================================================================
  // CARGA INICIAL
  // ============================================================================

  useEffect(() => {
    if (messageId) {
      loadReactions();
    } else {
      setReactions([]);
    }
  }, [messageId, loadReactions]);

  return {
    reactions,
    isLoading,
    addReaction,
    removeReaction,
    toggleReaction,
  };
}
