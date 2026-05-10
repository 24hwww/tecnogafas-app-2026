-- SAFETY GUARD
-- This file previously disabled RLS for shared_carts and granted broad anon access.
-- It is intentionally kept non-destructive because RLS must remain enabled.

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'shared_carts';
