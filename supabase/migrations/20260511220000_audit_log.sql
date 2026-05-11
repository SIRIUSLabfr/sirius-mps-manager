-- Audit-Log: unveraenderliche Historie von Edits an Vertragsdaten und Geraeten
-- (Append-only via RLS: jeder Authenticated User darf INSERT/SELECT, niemand
-- UPDATE/DELETE — damit ist die Historie auch fuer den Admin nicht
-- nachtraeglich manipulierbar.)

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_project_id_idx ON public.audit_log(project_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- KEIN UPDATE und KEIN DELETE: indem keine Policies existieren, lehnt
-- RLS jeden Modify-Versuch fuer authenticated User ab. Nur die Service-
-- Role kann (via supabase admin api) Rows manipulieren.
