-- Add invoice webhook columns to system_settings

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS invoice_webhook_url text;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS invoice_webhook_enabled boolean DEFAULT false;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS invoice_webhook_auth_token text;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS invoice_webhook_timeout integer DEFAULT 30;

COMMENT ON COLUMN system_settings.invoice_webhook_url IS 'Invoice webhook endpoint URL';
COMMENT ON COLUMN system_settings.invoice_webhook_enabled IS 'Enable invoice webhook sending';
COMMENT ON COLUMN system_settings.invoice_webhook_auth_token IS 'Bearer token for invoice webhook';
COMMENT ON COLUMN system_settings.invoice_webhook_timeout IS 'Webhook timeout in seconds';
