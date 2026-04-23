ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS credit_days integer,
  ADD COLUMN IF NOT EXISTS due_date date;

UPDATE public.sales
SET payment_terms = CASE
  WHEN COALESCE(amount_due, 0) > 0 THEN 'cod'
  ELSE 'immediate'
END
WHERE payment_terms IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN payment_terms SET DEFAULT 'immediate';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_payment_terms_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_payment_terms_check
      CHECK (payment_terms IS NULL OR payment_terms = ANY (ARRAY['immediate', 'cod', 'credit']));
  END IF;
END $$;
