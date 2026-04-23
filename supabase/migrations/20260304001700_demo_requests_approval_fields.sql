ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS approved_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_demo_requests_approved_user_id
  ON public.demo_requests(approved_user_id);
