import type { SupabaseClient } from '@supabase/supabase-js';

export interface PendingOrder {
  id: string;
  seller_id: string;
  client_id: string;
  order_data: Record<string, unknown>;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  attempt_count: number;
  last_attempt_at?: string;
  error_message?: string;
  api_order_id?: string;
  api_response?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      pending_orders: {
        Row: PendingOrder;
        Insert: Omit<PendingOrder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<PendingOrder>;
      };
    };
  };
}

export type TypedSupabaseClient = SupabaseClient<Database>;
