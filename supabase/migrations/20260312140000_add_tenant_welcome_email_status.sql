-- Track welcome email delivery status per tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS welcome_email_status text,
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_email_error text,
  ADD COLUMN IF NOT EXISTS welcome_email_error_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_welcome_email_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_welcome_email_status_check
      CHECK (
        welcome_email_status IS NULL
        OR welcome_email_status IN ('sent', 'failed', 'skipped')
      );
  END IF;
END $$;
