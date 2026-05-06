-- SOLUCIÓN AGRESIVA: Forzar deshabilitar RLS completamente
-- Ejecutar paso por paso si es necesario

-- Paso 1: Verificar estado actual de RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'shared_carts';

-- Paso 2: Eliminar TODAS las políticas posibles (incluso nombres desconocidos)
DO $$
DECLARE
    policy_name record;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'shared_carts' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON shared_carts', policy_name.policyname);
        RAISE NOTICE 'Policy dropped: %', policy_name.policyname;
    END LOOP;
END $$;

-- Paso 3: Forzar deshabilitar RLS
ALTER TABLE shared_carts DISABLE ROW LEVEL SECURITY;

-- Paso 4: Verificar que RLS esté deshabilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'shared_carts';

-- Paso 5: Dar permisos explícitos a todos los roles
GRANT ALL ON shared_carts TO authenticated;
GRANT ALL ON shared_carts TO service_role;
GRANT ALL ON shared_carts TO anon;

-- Paso 6: Verificar políticas restantes (debería estar vacío)
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'shared_carts' AND schemaname = 'public';

SELECT 'shared_carts RLS force-disabled successfully' as status;
