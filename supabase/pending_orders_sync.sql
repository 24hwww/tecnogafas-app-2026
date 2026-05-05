-- ============================================================================
-- TABLA: pending_orders
-- Pedidos que fallaron al sincronizar con la API externa
-- Se guardan temporalmente en Supabase hasta poder enviarlos
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificación del vendedor (quién creó el pedido)
  seller_id TEXT NOT NULL,
  seller_name TEXT,

  -- Datos del pedido (estructura completa)
  client_id TEXT NOT NULL,
  client_data JSONB NOT NULL, -- Datos completos del cliente

  -- Items del pedido
  items JSONB NOT NULL, -- Array de CartItem[]

  -- Detalles del pedido
  details JSONB, -- { commit, discount, recargo, transport, methodpay, otheremail, iva }

  -- Estado del sync
  status TEXT DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',      -- Esperando para sincronizar
        'syncing',      -- En proceso de sincronización
        'failed',       -- Falló el intento, se reintentará
        'completed'     -- Sincronizado exitosamente con API
      )
    ),

  -- Metadatos del sync
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,

  -- Respuesta de la API cuando se sincroniza
  api_response JSONB,
  synced_order_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pending_orders_seller
  ON pending_orders(seller_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_status
  ON pending_orders(status)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_pending_orders_created
  ON pending_orders(created_at DESC);

-- Para buscar pedidos que necesitan reintentar (más de 5 minutos desde último intento)
CREATE INDEX IF NOT EXISTS idx_pending_orders_retry
  ON pending_orders(status, last_attempt_at)
  WHERE status IN ('pending', 'failed');

-- ============================================================================
-- TRIGGER: Actualizar updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_pending_orders_updated_at ON pending_orders;

CREATE TRIGGER update_pending_orders_updated_at
  BEFORE UPDATE ON pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

-- Los vendedores solo pueden ver sus propios pedidos pendientes
DROP POLICY IF EXISTS "pending_orders_select_own" ON pending_orders;

CREATE POLICY "pending_orders_select_own"
ON pending_orders
FOR SELECT
USING (
  seller_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.metadata->>'role' = 'admin'
  )
);

-- Los vendedores solo pueden insertar sus propios pedidos
DROP POLICY IF EXISTS "pending_orders_insert_own" ON pending_orders;

CREATE POLICY "pending_orders_insert_own"
ON pending_orders
FOR INSERT
WITH CHECK (
  seller_id = auth.uid()::text
);

-- Los vendedores pueden actualizar solo sus propios pedidos
DROP POLICY IF EXISTS "pending_orders_update_own" ON pending_orders;

CREATE POLICY "pending_orders_update_own"
ON pending_orders
FOR UPDATE
USING (
  seller_id = auth.uid()::text
);

-- Los vendedores pueden eliminar solo sus propios pedidos completados
DROP POLICY IF EXISTS "pending_orders_delete_own" ON pending_orders;

CREATE POLICY "pending_orders_delete_own"
ON pending_orders
FOR DELETE
USING (
  seller_id = auth.uid()::text
  AND status = 'completed'
);

-- ============================================================================
-- REALTIME: Suscribir cambios para notificar a la app
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'pending_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE pending_orders;
  END IF;
END $$;

-- ============================================================================
-- FUNCTION: Marcar pedido como completado
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_pending_order_completed(
  p_order_id UUID,
  p_api_order_id TEXT,
  p_api_response JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE pending_orders
  SET
    status = 'completed',
    synced_order_id = p_api_order_id,
    api_response = p_api_response,
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Incrementar contador de intentos fallidos
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_pending_order_attempt(
  p_order_id UUID,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE pending_orders
  SET
    attempt_count = attempt_count + 1,
    status = CASE
      WHEN attempt_count >= 4 THEN 'failed'
      ELSE 'pending'
    END,
    last_error = p_error_message,
    last_attempt_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Pedidos pendientes por vendedor
-- ============================================================================

DROP VIEW IF EXISTS pending_orders_summary;

CREATE VIEW pending_orders_summary AS
SELECT
  id,
  seller_id,
  seller_name,
  client_id,
  client_data->>'name' as client_name,
  jsonb_array_length(items) as items_count,
  status,
  attempt_count,
  last_error,
  last_attempt_at,
  created_at,
  CASE
    WHEN last_attempt_at IS NULL THEN created_at
    ELSE last_attempt_at
  END as last_activity,
  CASE
    WHEN status = 'pending' AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '5 minutes')
      THEN true
    WHEN status = 'failed' AND last_attempt_at < NOW() - INTERVAL '15 minutes'
      THEN true
    ELSE false
  END as should_retry
FROM pending_orders
WHERE status IN ('pending', 'failed');

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT ALL ON pending_orders TO service_role;
GRANT ALL ON pending_orders_summary TO service_role;
GRANT EXECUTE ON FUNCTION mark_pending_order_completed(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_pending_order_attempt(UUID, TEXT) TO authenticated;
