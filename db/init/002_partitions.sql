-- =====================================================================
-- Monthly partition pre-creation for the `attempts` table.
-- Run AFTER 001_schema.sql (it assumes the parent table exists and a
-- default partition catches any rows that fall outside the explicit
-- ranges).
--
-- This file is idempotent: each `CREATE TABLE IF NOT EXISTS
-- attempts_YYYYMM` is safe to re-run. The `api` job runner can also
-- exec this every month to roll the window forward.
-- =====================================================================

DO $$
DECLARE
  start_month date := date_trunc('month', now())::date;
  i int;
  p_start date;
  p_end   date;
  p_name  text;
BEGIN
  FOR i IN 0..11 LOOP
    p_start := (start_month + (i || ' months')::interval)::date;
    p_end   := (start_month + ((i + 1) || ' months')::interval)::date;
    p_name  := 'attempts_' || to_char(p_start, 'YYYYMM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF attempts FOR VALUES FROM (%L) TO (%L);',
      p_name, p_start, p_end
    );
  END LOOP;
END $$;
