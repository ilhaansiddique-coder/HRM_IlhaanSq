ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;
