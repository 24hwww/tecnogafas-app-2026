-- ============================================================================
-- SHARED CARTS TABLE
-- Para compartir carritos entre usuarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  code TEXT UNIQUE NOT NULL,
  
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  
  items JSONB NOT NULL DEFAULT '[]',
  
  seller_id TEXT,
  
  expires_at TIMESTAMPTZ NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_shared_carts_code ON shared_carts(code);
CREATE INDEX IF NOT EXISTS idx_shared_carts_expires_at ON shared_carts(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_carts_is_active ON shared_carts(is_active);
CREATE INDEX IF NOT EXISTS idx_shared_carts_client_id ON shared_carts(client_id);

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_shared_carts_updated_at ON shared_carts;
CREATE TRIGGER update_shared_carts_updated_at
  BEFORE UPDATE ON shared_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Políticas de RLS
ALTER TABLE shared_carts ENABLE ROW LEVEL SECURITY;

-- Política para que cualquiera pueda leer carritos compartidos activos
DROP POLICY IF EXISTS "shared_carts_select_active" ON shared_carts;
CREATE POLICY "shared_carts_select_active"
ON shared_carts
FOR SELECT
USING (is_active = TRUE);

-- Política para que usuarios autenticados puedan crear carritos compartidos
DROP POLICY IF EXISTS "shared_carts_insert" ON shared_carts;
CREATE POLICY "shared_carts_insert"
ON shared_carts
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Añadir a la publicación de realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'shared_carts'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE shared_carts;
  END IF;
END $$;
