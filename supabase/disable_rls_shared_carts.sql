-- SAFETY GUARD
-- RLS must remain enabled. This file is intentionally non-destructive.

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'shared_carts';
