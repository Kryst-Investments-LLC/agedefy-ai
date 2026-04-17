# Change Management Policy

> **Last updated:** 2026-04-10  
> **Scope:** All code, infrastructure, and configuration changes to the Biozephyra platform

---

## 1. Purpose

Ensure all changes to the Biozephyra platform are reviewed, tested, approved, and auditable. This policy satisfies SOC 2 CC8.1 (Change Management) and CC5.3 (Deployment through policies).

---

## 2. Change Categories

| Category | Description | Approval Required |
|----------|-------------|-------------------|
| **Standard** | Feature development, bug fixes, refactoring | 1 reviewer PR approval |
| **Sensitive** | Auth, RBAC, encryption, data model, AI governance changes | 2 reviewer PR approvals |
| **Emergency** | Production incident hotfix | 1 reviewer + post-merge review within 24 h |
| **Infrastructure** | Environment variables, DNS, CI config, provider settings | 1 reviewer + deploy approval |

---

## 3. Development Workflow

### 3.1 Branch Strategy

- **`main`** — protected, deployable at all times
- Feature branches created from `main`, named `<type>/<description>` (e.g. `feat/api-key-management`)
- No direct pushes to `main`

### 3.2 Pull Request Requirements

All changes must go through a pull request with:

1. **Descriptive title and body** explaining what and why
2. **Linked issue** (when applicable)
3. **Passing CI checks** (mandatory, non-bypassable):
   - `pnpm typecheck` — zero TypeScript errors
   - `pnpm lint` — zero ESLint violations
   - `npx vitest run` — all tests pass
   - `pnpm audit --audit-level=critical` — no critical vulnerabilities
   - CodeQL security scan — no new findings
   - Trivy container scan — no critical/high CVEs
4. **Minimum 1 approving review** (2 for sensitive changes)
5. **No force-pushes** after review approval

### 3.3 Sensitive Change Detection

Changes to these paths require 2 reviewers:

```
lib/auth.ts
lib/rbac.ts
lib/mfa.ts
lib/session-governance.ts
lib/api-keys/**
lib/audit.ts
lib/audit-integrity.ts
lib/tenancy.ts
lib/consent.ts
lib/ai/governance.ts
prisma/schema.prisma (model changes)
proxy.ts
```

---

## 4. CI/CD Pipeline

### 4.1 Pipeline Stages

```
Push/PR → Lint → Type-check → Test → Audit → Security Scan → Build → Deploy (main only)
```

### 4.2 CI Configuration

- **Platform:** GitHub Actions
- **CI file:** `.github/workflows/ci.yml`
- **Security scans:** `.github/workflows/codeql-analysis.yml`
- **Dependency monitoring:** Dependabot (`.github/dependabot.yml`)

### 4.3 Deployment

- **Production:** Automatic on merge to `main` via Vercel
- **Preview:** Automatic on PR creation (Vercel Preview Deployments)
- **Rollback:** Instant via Vercel deployment rollback (previous known-good deployment)

---

## 5. Database Changes

### 5.1 Schema Changes

1. Modify `prisma/schema.prisma`
2. Run `pnpm db:generate` to update Prisma client
3. Test with `pnpm db:push` against local SQLite
4. For production: generate migration with `prisma migrate dev --name <description>`
5. Migration reviewed as part of PR
6. Applied to production on deploy via `prisma migrate deploy`

### 5.2 Data Migrations

- Must be idempotent and backwards-compatible
- Include rollback procedure in PR description
- Test against a copy of production data when possible

---

## 6. Emergency Change Process

When a production incident requires an immediate fix:

1. IC (Incident Commander) approves the emergency change
2. Create a branch, implement the fix
3. Open PR — **1 reviewer** reviews and approves (can be IC)
4. Merge and deploy
5. Within **24 hours**: a second reviewer conducts a post-merge review
6. Document in the incident post-mortem

---

## 7. Configuration & Secret Management

| Type | Storage | Access |
|------|---------|--------|
| Environment variables | Vercel Environment Variables | Team members with deploy access |
| API keys (platform) | Vercel env vars, never committed to code | Rotated quarterly or on compromise |
| API keys (user-facing) | SHA-256 hashed in database (`APIKey.keyHash`) | Users manage via API; raw key shown once |
| MFA secrets | Encrypted in database (`UserMfaSecret.secret`) | Per-user, server-side only |
| JWT secret | `JWT_SECRET_KEY` env var | Rotated on compromise; forces all sessions to re-authenticate |

---

## 8. Audit Trail

Every change is traceable:

- **Code changes:** Git commit history with author, timestamp, PR link
- **Data mutations:** SHA-256 hash-chained audit log (`lib/audit.ts`)
- **Access:** Session creation/revocation logged; API key usage metered
- **Configuration:** Vercel deployment logs with environment variable change history

---

## 9. Policy Review

- This policy is reviewed **quarterly**
- Updated after any process failure or near-miss
- Changes to this policy follow the Standard change process
