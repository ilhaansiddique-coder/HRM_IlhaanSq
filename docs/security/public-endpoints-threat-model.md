# Public Endpoint Threat Model

Date: 2026-03-10

## Scope

The following Supabase Edge Functions intentionally remain public (`verify_jwt = false`):

1. `demo-signup`
2. `tenant-invite-details`
3. `stripe-webhook`

All other sensitive operational endpoints are JWT-protected.

## Endpoint Controls

### `demo-signup`

- Threats:
  - Automated abuse and spam submissions.
  - Payload tampering and replay.
- Controls:
  - IP-based rate limiting via `_shared/rateLimiter.ts` (`RateLimitPresets.auth`).
  - Input validation and sanitization in `_shared/validation.ts`.
  - Optional HMAC request signature verification using `_shared/requestSignature.ts`.
    - Enable by setting `PUBLIC_ENDPOINT_SIGNING_SECRET`.
    - Header contract:
      - `x-request-timestamp`
      - `x-request-signature` (HMAC-SHA256 over `${timestamp}.${rawBody}`)

### `tenant-invite-details`

- Threats:
  - Token enumeration / invite metadata scraping.
  - Automated probing.
- Controls:
  - IP-based rate limiting via `_shared/rateLimiter.ts` (`RateLimitPresets.standard`).
  - UUID token format validation and sanitization.
  - Optional HMAC request signatures on non-GET requests using `_shared/requestSignature.ts`
    (same headers and secret as above).

### `stripe-webhook`

- Threats:
  - Forged webhook requests.
  - Webhook flood attacks.
- Controls:
  - Required Stripe signature verification (`stripe-signature`) against `STRIPE_WEBHOOK_SECRET`.
  - Method restriction (`POST` only).
  - Rate limiting via `_shared/rateLimiter.ts` (`RateLimitPresets.webhook`).

## Residual Risk

- Public browser-facing flows cannot safely embed a secret signing key in frontend code.
- For strict request signing on browser flows, route these endpoints through a trusted backend/BFF and sign server-side.
