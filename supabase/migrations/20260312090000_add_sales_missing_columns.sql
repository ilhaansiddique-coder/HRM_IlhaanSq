-- Add missing sales columns needed by UI + invoice webhook

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS lost_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

COMMENT ON COLUMN sales.customer_email IS 'Customer email captured at time of sale';
COMMENT ON COLUMN sales.tax_amount IS 'Tax amount for the sale';
COMMENT ON COLUMN sales.notes IS 'Internal notes for the sale';
COMMENT ON COLUMN sales.cancelled_at IS 'Timestamp when sale was cancelled';
COMMENT ON COLUMN sales.returned_at IS 'Timestamp when sale was returned';
COMMENT ON COLUMN sales.lost_at IS 'Timestamp when sale was marked lost';
COMMENT ON COLUMN sales.status_changed_at IS 'Timestamp of last courier/payment status change';
