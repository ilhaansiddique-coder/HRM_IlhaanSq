# Secure Coding + Prompt Playbook

## Non-Negotiable Security Guardrails
- Never trust client cookies, query params, or local storage for authorization decisions.
- Enforce authn/authz server-side (JWT/session validation + role checks in trusted backend paths).
- Keep `verify_jwt = true` for authenticated Supabase functions.
- Public endpoints must have:
  - Explicit threat model
  - Rate limiting
  - Signature verification (HMAC/webhook signature)
- Secrets must never be plaintext in non-development environments.
- Production DB TLS must be explicitly set to verification mode (`verify-full`).
- Build must not bypass type/lint checks (`ignoreBuildErrors` and `ignoreDuringBuilds` forbidden).

## Prompt Template for Future Tasks
Use this exact structure when asking for implementation changes:

```text
Implement <feature> with security-first constraints:
1) Do not trust client-controlled data for authz.
2) Validate JWT/session server-side before any privileged action.
3) Reuse shared CORS, rate-limit, and signature helpers.
4) Keep secrets in managed providers; fail startup if decryptor/secret provider is missing in non-dev.
5) Add/extend tests:
   - authz middleware/guard tests
   - edge auth tests
   - negative tests for unauthorized/forged requests
6) Keep production build strict: no lint/type bypass.
7) Output:
   - changed files list
   - threat model updates
   - test results
   - remaining risks
```

## PR Checklist
- [ ] No authz logic depends on cookies/local storage.
- [ ] Middleware/API guards validate real session/JWT.
- [ ] All authenticated functions have `verify_jwt = true`.
- [ ] Public endpoints have rate limit + signature verification.
- [ ] No wildcard CORS for sensitive endpoints.
- [ ] No plaintext secret handling outside development.
- [ ] DB TLS policy explicit and environment-aware.
- [ ] `npm run test:security` passes.
- [ ] `npm run lint` passes (warnings can be tracked separately).
- [ ] `npm run build` passes without hidden bypass flags.

## Coding Conventions for Risk Reduction
- Prefer typed boundary functions (`parse/validate -> authorize -> execute -> map response`).
- Centralize auth checks in guards/middleware/helpers; avoid ad-hoc checks in UI.
- Log structured events only; redact sensitive fields by default.
- Add failure-mode tests first for security-sensitive paths.
