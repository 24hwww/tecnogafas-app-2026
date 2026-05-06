-- SOLUCIÓN DEFINITIVA para shared_carts
-- Limpiar todas las políticas existentes y deshabilitar RLS

-- 1. Eliminar todas las políticas existentes (si las hay)
DROP POLICY IF EXISTS "shared_carts_select_all" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_insert_all" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_update_all" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_delete_all" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_select_active" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_insert" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_allow_all" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_allow_all_insert" ON shared_carts;
DROP POLICY IF EXISTS "shared_carts_own" ON shared_carts;

-- 2. Deshabilitar completamente RLS para esta tabla
ALTER TABLE shared_carts DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que RLS esté deshabilitado
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'shared_carts';

-- 4. Opcional: Dar permisos explícitos (si RLS está deshabilitado no es necesario)
-- GRANT ALL ON shared_carts TO authenticated;
-- GRANT ALL ON shared_carts TO service_role;

SELECT 'shared_carts RLS disabled successfully' as status;
