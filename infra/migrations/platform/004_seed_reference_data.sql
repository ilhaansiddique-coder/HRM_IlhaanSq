-- v8 platform control-plane migration pack
-- File 004: reference data seeds

INSERT INTO public.courier_providers (code, name, region, is_active, docs_url)
VALUES
  ('pathao', 'Pathao', 'BD', true, 'https://docs.pathao.com/'),
  ('steadfast', 'Steadfast', 'BD', true, 'https://steadfast.com.bd/'),
  ('redx', 'REDX', 'BD', true, 'https://redx.com.bd/'),
  ('paperfly', 'Paperfly', 'BD', true, NULL),
  ('sundarban', 'Sundarban', 'BD', true, NULL),
  ('fedex', 'FedEx', 'Global', true, 'https://developer.fedex.com/'),
  ('dhl', 'DHL', 'Global', true, 'https://developer.dhl.com/')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  region = EXCLUDED.region,
  is_active = EXCLUDED.is_active,
  docs_url = EXCLUDED.docs_url;

INSERT INTO public.courier_provider_capabilities (provider_code, capability)
VALUES
  ('pathao', 'create_shipment'),
  ('pathao', 'track_shipment'),
  ('pathao', 'cancel_shipment'),
  ('steadfast', 'create_shipment'),
  ('steadfast', 'track_shipment'),
  ('redx', 'create_shipment'),
  ('redx', 'track_shipment'),
  ('paperfly', 'create_shipment'),
  ('sundarban', 'create_shipment'),
  ('fedex', 'create_shipment'),
  ('fedex', 'track_shipment'),
  ('fedex', 'fetch_label'),
  ('dhl', 'create_shipment'),
  ('dhl', 'track_shipment'),
  ('dhl', 'fetch_label')
ON CONFLICT (provider_code, capability) DO NOTHING;
