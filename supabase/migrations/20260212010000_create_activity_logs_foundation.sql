-- Foundation for activity logs used by app logging, admin logs, and monitoring queries.
-- This must run before later policy/view migrations that reference activity_logs.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.activity_logs_view AS
      SELECT
        al.id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.summary,
        al.details,
        al.created_at,
        p.full_name,
        p.email
      FROM public.activity_logs al
      LEFT JOIN public.profiles p ON p.id = al.user_id
    $sql$;
  ELSE
    RAISE NOTICE 'profiles table not found while creating activity_logs_view; creating fallback view';
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.activity_logs_view AS
      SELECT
        al.id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.summary,
        al.details,
        al.created_at,
        NULL::text AS full_name,
        NULL::text AS email
      FROM public.activity_logs al
    $sql$;
  END IF;
END $$;

ALTER VIEW public.activity_logs_view SET (security_invoker = on);
