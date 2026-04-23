-- Add missing customer soft-delete columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN customers.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN customers.deleted_at IS 'Soft delete timestamp';

-- Add missing business_settings column used by app
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS invoice_count_start integer DEFAULT 1;
COMMENT ON COLUMN business_settings.invoice_count_start IS 'Starting invoice number counter';
