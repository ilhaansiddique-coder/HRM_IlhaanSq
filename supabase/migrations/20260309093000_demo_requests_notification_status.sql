ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS request_notification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS request_notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_notification_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demo_requests_request_notification_status_check'
  ) THEN
    ALTER TABLE public.demo_requests
      ADD CONSTRAINT demo_requests_request_notification_status_check
      CHECK (request_notification_status = ANY (ARRAY['pending', 'sent', 'failed', 'skipped']));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_demo_requests_request_notification_status
  ON public.demo_requests(request_notification_status, created_at DESC);
