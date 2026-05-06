-- Crear políticas RLS para shared_carts que permitan inserciones
-- Habilitar RLS primero
ALTER TABLE shared_carts ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todo a usuarios autenticados
CREATE POLICY "shared_carts_select_all" ON shared_carts
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "shared_carts_insert_all" ON shared_carts
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "shared_carts_update_all" ON shared_carts
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "shared_carts_delete_all" ON shared_carts
FOR DELETE USING (auth.role() = 'authenticated');

-- Alternativa: política más restrictiva si se prefiere
-- CREATE POLICY "shared_carts_own" ON shared_carts
-- FOR ALL USING (auth.uid() IS NOT NULL);
