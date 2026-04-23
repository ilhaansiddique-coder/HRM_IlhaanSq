ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS requested_domain TEXT;

CREATE INDEX IF NOT EXISTS idx_demo_requests_requested_domain
  ON public.demo_requests(requested_domain);
