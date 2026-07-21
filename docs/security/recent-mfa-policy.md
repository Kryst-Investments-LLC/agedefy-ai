# Recent MFA policy

Human-session operations that can change privileges, publish or approve health
or research content, expose bulk data, rotate secrets, initiate impersonation,
or irreversibly remove user/research records require a server-recorded MFA
challenge no more than ten minutes old.

The shared guard is `lib/security/recent-mfa.ts`. It reads `lastVerifiedAt` from
the database and rejects missing, stale, or future timestamps with HTTP 428 and
the stable code `recent_mfa_required`. Client claims cannot satisfy the guard.

## Deliberate exemptions

- Consent withdrawal: adding step-up friction could unlawfully obstruct withdrawal.
- MFA disablement: the route verifies a TOTP or single-use backup code directly.
- Stopping impersonation: ending elevated context is a risk-reducing action.
- SCIM mutations: authenticated machine-to-machine provisioning has no interactive
  MFA ceremony and must instead use scoped credentials, replay controls, audit,
  and provider-side administrator MFA.
- API-authenticated scientific model deletion: noninteractive credentials cannot
  perform an MFA ceremony; these routes require scoped-key and ownership controls.

Any new human-session privileged or destructive route must invoke the shared
guard after authentication and before reading its mutation payload.
