# SOC 2 Trust Service Criteria — Controls Mapping

> **Status:** Evidence-based mapping of implemented controls. Items marked ⬜ are planned but not yet in code.
>
> **Last updated:** 2026-04-10

---

## CC1 — Control Environment

| Control | Evidence | Status |
|---------|----------|--------|
| CC1.1 Board/management oversight of security | `SECURITY.md` responsible disclosure policy; admin-only routes gated by RBAC | ✅ Implemented |
| CC1.2 Organizational structure & authority | Role enum (`ADMIN`, `CLINICIAN`, `RESEARCHER`, `USER`) in `prisma/schema.prisma`; `lib/rbac.ts` enforces role hierarchy | ✅ Implemented |
| CC1.3 Competence of personnel | PR review requirements in CI; CodeQL + Trivy scans on every push (`.github/workflows/ci.yml`, `.github/workflows/codeql-analysis.yml`) | ✅ Implemented |
| CC1.4 Accountability | SHA-256 hash-chained audit log (`lib/audit.ts`, `lib/audit-integrity.ts`); every mutation is audited with actor + tenant + entity | ✅ Implemented |

## CC2 — Communication & Information

| Control | Evidence | Status |
|---------|----------|--------|
| CC2.1 Internal communication of security objectives | `SECURITY.md` documents architecture controls; `docs/AGENTS.md` documents platform conventions | ✅ Implemented |
| CC2.2 External communication | SECURITY.md has responsible disclosure; Contact page links `security@biozephyra.com`; OpenAPI spec at `/api/v1/openapi.json` | ✅ Implemented |
| CC2.3 Consent communication | GDPR consent collection UI (`components/consent-collection.tsx`); 3 categories with per-category revocation (`app/api/consent/route.ts`) | ✅ Implemented |

## CC3 — Risk Assessment

| Control | Evidence | Status |
|---------|----------|--------|
| CC3.1 Specify security objectives | Rate limit abuse monitoring (`lib/rate-limit-monitor.ts`) auto-creates ReviewItems | ✅ Implemented |
| CC3.2 Identify and analyse risks | Dependabot (`dependabot.yml`); `pnpm audit` in CI; Trivy container scan; CodeQL SAST | ✅ Implemented |
| CC3.3 Consider fraud risk | API key SHA-256 hashing (never store raw); MFA for admin/clinician roles; session concurrency limits | ✅ Implemented |
| CC3.4 Identify changes that could affect controls | CI gate blocks merge on failing type-check, lint, or tests; branch protection requires PR review | ✅ Implemented |

## CC4 — Monitoring Activities

| Control | Evidence | Status |
|---------|----------|--------|
| CC4.1 Ongoing monitoring | OpenTelemetry instrumentation (`instrumentation.ts`); request-context correlation IDs; rate-limit block counters | ✅ Implemented |
| CC4.2 Evaluate and communicate deficiencies | ReviewItem model with OPEN/IN_PROGRESS/RESOLVED flow; abuse threshold triggers auto-review | ✅ Implemented |

## CC5 — Control Activities

| Control | Evidence | Status |
|---------|----------|--------|
| CC5.1 Select and develop controls | Multi-layer: RBAC → tenant scoping → rate limit → GDPR consent → MFA → circuit breaker → idempotency | ✅ Implemented |
| CC5.2 Technology general controls | HSTS with preload, CSP, X-Frame-Options, X-Content-Type-Options (`next.config.mjs`); Permissions-Policy | ✅ Implemented |
| CC5.3 Deploy through policies and procedures | CI pipeline: lint → type-check → test → audit → security scan → build. Documented in `docs/CHANGE-MANAGEMENT-POLICY.md` | ✅ Implemented |

## CC6 — Logical & Physical Access

| Control | Evidence | Status |
|---------|----------|--------|
| CC6.1 Logical access security | NextAuth session; MFA enforcement for ADMIN/CLINICIAN (`lib/mfa.ts`); session governance with concurrent limits (`lib/session-governance.ts`) | ✅ Implemented |
| CC6.2 User credentials | Passwords via NextAuth Credentials provider; MFA TOTP + backup codes; API keys SHA-256 hashed (`lib/api-keys/manager.ts`) | ✅ Implemented |
| CC6.3 Authorized access | `lib/rbac.ts` requireAuth/requireRole/requireAuthWithRole; API key scopes per endpoint; tenant membership validation (`lib/tenancy.ts`) | ✅ Implemented |
| CC6.4 Restrict physical access | Cloud-hosted (Vercel/cloud provider); no on-premise infrastructure | ✅ N/A (cloud) |
| CC6.5 Manage disposal of assets | Data retention script `scripts/orchestration-retention.ts`; GDPR data export/deletion endpoints | ✅ Implemented |
| CC6.6 Restrict and secure API access | Per-key rate limiting + scope enforcement (`lib/api-keys/middleware.ts`); sandbox mode for test keys | ✅ Implemented |
| CC6.7 Manage identity lifecycle | Session revocation (`revokeSession`/`revokeAllSessions`); API key revocation/rotation; user deletion cascades | ✅ Implemented |
| CC6.8 Remote access | HTTPS/TLS enforced via HSTS preload; no plaintext endpoints | ✅ Implemented |

## CC7 — System Operations

| Control | Evidence | Status |
|---------|----------|--------|
| CC7.1 Detect and manage system changes | CI/CD gate on GitHub Actions; CodeQL + Trivy on push/PR. Documented in `docs/CHANGE-MANAGEMENT-POLICY.md` | ✅ Implemented |
| CC7.2 Monitor system components | OpenTelemetry spans + metrics; `rateLimitBlockedCounter`; circuit breaker state tracking | ✅ Implemented |
| CC7.3 Evaluate security events | Abuse monitoring creates ReviewItems; audit chain integrity verification (`verifyAuditChain`) | ✅ Implemented |
| CC7.4 Incident response | Documented in `docs/INCIDENT-RESPONSE-RUNBOOK.md` | ✅ Documented |
| CC7.5 Recovery from incidents | Runbook includes recovery procedures; Vercel snapshot rollback; DB backup/restore via provider | ✅ Documented |

## CC8 — Change Management

| Control | Evidence | Status |
|---------|----------|--------|
| CC8.1 Manage changes to infrastructure and software | PR-required branch protection; CI must pass; documented in `docs/CHANGE-MANAGEMENT-POLICY.md` | ✅ Implemented |

## CC9 — Risk Mitigation

| Control | Evidence | Status |
|---------|----------|--------|
| CC9.1 Identify and assess risk of vendor relationships | AI provider allowlist in `lib/ai/governance.ts`; per-provider cost tracking; circuit breaker on external calls | ✅ Implemented |
| CC9.2 Assess risk of using external parties | Stripe PCI handled by Stripe.js; AI providers use API keys (never user data tokens) | ✅ Implemented |

---

## Additional Trust Service Categories

### Availability

| Control | Evidence | Status |
|---------|----------|--------|
| A1.1 System availability commitments | Circuit breaker pattern (`lib/circuit-breaker.ts`); rate limiting prevents resource exhaustion; CDN via Vercel Edge | ✅ Implemented |
| A1.2 Data backup and recovery | Database managed by cloud provider with automated backups | ✅ Provider-managed |

### Confidentiality

| Control | Evidence | Status |
|---------|----------|--------|
| C1.1 Protect confidential information | Tenant isolation at application layer (`scopedDb`); RBAC on all sensitive endpoints; field-level consent gating | ✅ Implemented |
| C1.2 Dispose of confidential information | Data retention script; user deletion cascades; GDPR right-to-erasure endpoint | ✅ Implemented |

### Processing Integrity

| Control | Evidence | Status |
|---------|----------|--------|
| PI1.1 Processing is complete and accurate | Idempotency keys prevent duplicate processing (`lib/idempotency.ts`); Zod validation on all inputs | ✅ Implemented |
| PI1.2 Input validation | Zod schemas on every API route; type-safe Prisma queries | ✅ Implemented |
| PI1.3 Error handling | Circuit breaker with fallbacks; structured error responses; error logging to OTel | ✅ Implemented |

### Privacy

| Control | Evidence | Status |
|---------|----------|--------|
| P1.1 Privacy notice | GDPR consent categories with clear descriptions (`components/consent-collection.tsx`); cookie consent banner | ✅ Implemented |
| P1.2 Consent management | Per-category GDPR consent with grant/revoke/version tracking; `requireGdprConsent` middleware | ✅ Implemented |
| P1.3 Personal data collection | Minimal data collection; explicit biomarker consent; no passive tracking | ✅ Implemented |
| P1.4 Use and retention | Configurable retention periods per data class; auto-purge via retention script | ✅ Implemented |
| P1.5 Data subject rights | Data export, deletion, consent revocation endpoints; privacy@biozephyra.com contact | ✅ Implemented |
| P1.6 Data breach notification | Incident response runbook includes 72-hour GDPR breach notification procedure | ✅ Documented |

---

## Gaps Requiring External Action

| Gap | Action Required | Status |
|-----|----------------|--------|
| Row-Level Security (RLS) | Configure PostgreSQL RLS policies in production to supplement application-level filtering | ⬜ Planned |
| SBOM generation | Add `@cyclonedx/cyclonedx-npm` to CI pipeline for software bill of materials | ⬜ Planned |
| SOC 2 Type II audit engagement | Select auditor, scope audit, provide evidence package | ⬜ Planned (budget required) |
| Compliance automation | Integrate Vanta or Drata for continuous monitoring | ⬜ Planned (budget required) |
| Encryption at rest verification | Document provider-level encryption keys and rotation policy | ⬜ Planned |
