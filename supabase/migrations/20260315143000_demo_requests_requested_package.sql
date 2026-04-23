ALTER TABLE public.demo_requests
ADD COLUMN IF NOT EXISTS requested_package TEXT;

UPDATE public.demo_requests
SET requested_package = 'starter'
WHERE requested_package IS NULL OR btrim(requested_package) = '';

ALTER TABLE public.demo_requests
ALTER COLUMN requested_package SET DEFAULT 'starter';

ALTER TABLE public.demo_requests
ALTER COLUMN requested_package SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demo_requests_requested_package_check'
  ) THEN
    ALTER TABLE public.demo_requests
      ADD CONSTRAINT demo_requests_requested_package_check
      CHECK (requested_package IN ('starter', 'professional', 'enterprise'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_demo_requests_requested_package
  ON public.demo_requests(requested_package);
