-- SAFETY GUARD
-- This migration name is historical. It no longer disables RLS or drops policies.
-- Use supabase/shared_carts.sql for controlled policy changes.

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'shared_carts';
