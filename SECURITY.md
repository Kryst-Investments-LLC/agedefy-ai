# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you believe you have found a security
vulnerability in Biozephyra AI, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

Email: **security@biozephyra.com**

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof of concept if possible)
- The affected component or endpoint
- Your suggested severity (Critical / High / Medium / Low)

### What to Expect

| Timeframe       | Action                                      |
|-----------------|---------------------------------------------|
| 24 hours        | Acknowledgement of your report              |
| 72 hours        | Initial triage and severity assessment      |
| 7 days          | Status update with remediation plan         |
| 30 days (target)| Fix deployed or mitigation in place         |

### Safe Harbour

We will not pursue legal action against researchers who:

- Act in good faith and follow this policy
- Avoid accessing or modifying other users' data
- Do not degrade or disrupt production services
- Report findings promptly and do not publicly disclose before a fix is available

### Scope

In scope:

- The Biozephyra AI web application and API
- Authentication, authorization, and session management
- Data handling and privacy controls
- AI governance and model interaction endpoints

Out of scope:

- Third-party services (Stripe, AI providers, email services)
- Social engineering or phishing attacks
- Denial of service attacks
- Issues in dependencies already reported upstream

### Recognition

We maintain a security acknowledgements page and are happy to credit
researchers who report valid vulnerabilities (with their permission).

### Incident Response

For a confirmed incident we follow the operational runbooks in
[`docs/runbooks/production-launch-runbooks.md`](docs/runbooks/production-launch-runbooks.md)
and use the pre-drafted communications in
[`docs/security/incident-communication-templates.md`](docs/security/incident-communication-templates.md)
— reporter acknowledgement/status/resolution, internal incident declaration,
status-page updates, public advisories, and GDPR Art. 33/34 breach
notifications. A confirmed personal-data breach triggers the DPO review and, if
notifiable, supervisory-authority notification within 72 hours.

## Security Architecture

Biozephyra AI implements the following security controls:

- **Authentication:** NextAuth with Credentials + OIDC SSO, MFA enforcement
- **Authorization:** Centralized RBAC (`lib/rbac.ts`) on all admin and clinician routes
- **Audit trail:** SHA-256 hash-chained immutable audit log (`lib/audit-integrity.ts`)
- **Tenant isolation:** Application-level tenant scoping on all data models
- **AI governance:** Model allowlist, per-request audit, cost tracking (`lib/ai/governance.ts`)
- **Rate limiting:** Redis-backed with in-memory fallback, abuse monitoring
- **Data consent:** GDPR consent management with granular categories
- **Session governance:** Forced logout, idle timeout, concurrent session limits
- **CI security:** CodeQL, Trivy SAST, Dependabot, `pnpm audit` in pipeline
- **Transport:** HSTS with preload, CSP, X-Frame-Options, X-Content-Type-Options
