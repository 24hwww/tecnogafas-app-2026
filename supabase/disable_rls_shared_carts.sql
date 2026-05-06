-- Deshabilitar RLS para la tabla shared_carts
ALTER TABLE shared_carts DISABLE ROW LEVEL SECURITY;

-- Opcional: crear políticas permisivas si se quiere mantener RLS activo
-- DROP POLICY IF EXISTS "shared_carts_select_active" ON shared_carts;
-- DROP POLICY IF EXISTS "shared_carts_insert" ON shared_carts;

-- Crear políticas que permitan todo si se prefiere mantener RLS
-- CREATE POLICY "shared_carts_allow_all" ON shared_carts FOR ALL USING (true);
-- CREATE POLICY "shared_carts_allow_all_insert" ON shared_carts FOR INSERT WITH CHECK (true);
