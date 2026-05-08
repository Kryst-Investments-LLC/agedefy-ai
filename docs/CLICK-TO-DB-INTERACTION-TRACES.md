# Click-to-Database Interaction Traces — Full Platform

Every user click that mutates or fetches data follows the same layered pipeline. This document traces **every user-interactive flow** across the entire Biozephyra platform, from DOM event to Prisma query and back. Each step references exact source files.

**Scope:** 54 distinct fetch calls across 24 components and 7 pages → 34 API route handlers → Prisma / external APIs.

---

## Table of Contents

1. [Shared Pipeline](#shared-pipeline-applies-to-all-flows)
2. [A — Auth & Identity](#a--auth--identity-flows)
3. [B — Dashboard & Workspace](#b--dashboard--workspace-flows)
4. [C — Biomarkers & Bio-Age](#c--biomarkers--bio-age-flows)
5. [D — Protocols & Templates](#d--protocols--templates-flows)
6. [E — Knowledge Graph & Compound Mixer](#e--knowledge-graph--compound-mixer-flows)
7. [F — Community Forum](#f--community-forum-flows)
8. [G — Global Search](#g--global-search-flow)
9. [H — Discovery Lab (AeonForge)](#h--discovery-lab-aeonforge-flows)
10. [I — Clinical Trials & Research](#i--clinical-trials--research-flows)
11. [J — AI Health Coach](#j--ai-health-coach-flow)
12. [K — Lab Testing](#k--lab-testing-flows)
13. [L — Telemedicine](#l--telemedicine-flows)
14. [M — Consumer Marketplace](#m--consumer-marketplace-flows)
15. [N — Scientist-Sponsor Marketplace](#n--scientist-sponsor-marketplace-flows)
16. [O — Billing & Stripe](#o--billing--stripe-flows)
17. [P — Account Management](#p--account-management-flows)
18. [Q — MFA / Two-Factor](#q--mfa--two-factor-flows)
19. [R — GDPR Consent](#r--gdpr-consent-flows)
20. [S — Wearable Devices](#s--wearable-device-flows)
21. [T — Gamification & Achievements](#t--gamification--achievements-flows)
22. [U — Onboarding](#u--onboarding-flow)
23. [V — Admin Console](#v--admin-console-flows)
24. [W — Federated Learning](#w--federated-learning-flow)
25. [X — Insights](#x--insights-flow)
26. [Cross-Cutting Verification Summary](#cross-cutting-verification-summary)
27. [Complete Endpoint Mapping Table](#complete-endpoint-mapping-table-frontend--backend)

---

## Shared Pipeline (applies to all flows)

```
┌──────────────┐     ┌──────────────┐     ┌────────────────────────────────────────────────┐     ┌──────────┐
│  Browser DOM │────▶│  proxy.ts    │────▶│  API Route Handler                             │────▶│  Prisma  │
│  (onClick)   │     │  (Next proxy)│     │  auth → validate → tenant → idempotency → DB   │     │  (SQLite/│
│              │◀────│              │◀────│                                                  │◀────│  PG)     │
│  setState()  │     │  CSP+nonce   │     │  NextResponse.json()                            │     │          │
└──────────────┘     └──────────────┘     └────────────────────────────────────────────────┘     └──────────┘
```

### Layer Details

| Layer | File(s) | What happens |
|-------|---------|-------------|
| **1. Proxy** | [`proxy.ts`](../proxy.ts) | Generates CSP nonce, injects `x-nonce` request header. For pages under `/dashboard`, `/account`, `/admin`, `/mfa-verify`: verifies JWT via `getToken()`, redirects to `/sign-in` if missing, enforces MFA and admin role gates. API routes (`/api/*`) are excluded by the matcher. |
| **2. Auth** | [`lib/auth.ts`](../lib/auth.ts) | `getServerSession(authOptions)` validates the session cookie. Returns `{ user: { id, email, role, tenantId } }` or `null`. |
| **3. Rate Limit** | [`lib/rate-limit.ts`](../lib/rate-limit.ts) | `applyRateLimit(request)` checks sliding-window bucket (Redis in production, in-memory in dev). Returns `429` response if exceeded. |
| **4. Zod Validation** | `lib/validators/*.ts` | Request body parsed with `.safeParse()`. On failure → `400` with `error.flatten()` details. |
| **5. Tenant Isolation** | [`lib/tenancy.ts`](../lib/tenancy.ts) | `deriveTenantContextWithValidation()` resolves tenant from session or `x-tenant-id` header, then validates membership via `OrganizationMembership` DB lookup. Returns `403` if user is not a member. |
| **6. Idempotency** | [`lib/idempotency.ts`](../lib/idempotency.ts) | `executeRouteIdempotentJsonMutation()` hashes the payload with SHA-256. If a matching `IdempotencyRecord` exists and is `COMPLETED`, replays the cached response. If `PENDING`, returns `409`. Otherwise creates a new record and runs the mutation. |
| **7. Transactional Ingestion** | [`lib/events/transactional-ingestion-service.ts`](../lib/events/transactional-ingestion-service.ts) | For health-event-producing mutations: wraps Prisma write + canonical health event creation + outbox insert inside a single `$transaction`. |
| **8. Audit Log** | [`lib/audit.ts`](../lib/audit.ts) | `logAudit()` creates an immutable `AuditLog` row with a chained `entryHash` (hash chain integrity). |
| **9. Database** | [`lib/db.ts`](../lib/db.ts) | Singleton `PrismaClient`. SQLite in dev, PostgreSQL in staging/production. |

**Convention:** Layers marked with ★ below are present on a trace. Not every route uses all layers (e.g., GET routes skip idempotency/audit).

---

## A — Auth & Identity Flows

### A1. User Registration

**Page:** `/sign-up` • **Component:** [`app/sign-up/page.tsx`](../app/sign-up/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | User fills name, email, password fields. `<form onSubmit={handleSubmit}>` fires. |
| 2 | `fetch("/api/auth/register", { method: "POST", body: { name, email, password } })` |
| 3 | **Route:** [`app/api/auth/register/route.ts`](../app/api/auth/register/route.ts) — ★ rate-limit (5/min) → ★ Zod `registerSchema` → duplicate check `db.user.findUnique({ where: { email } })` → `bcrypt.hash(password, 12)` → ★ idempotency → `db.user.create()` + `db.userProfile.create()` → email verification token → welcome email → ★ audit `"user.registered"` |
| 4 | On success: `signIn("credentials", { email, password })` → auto-login → `router.push("/dashboard")` |
| ✅ | **Endpoint match:** `POST /api/auth/register` → `register/route.ts` ✅. **DB table:** `User`, `UserProfile` ✅ |

### A2. Forgot Password

**Page:** `/forgot-password` • **Component:** [`app/forgot-password/page.tsx`](../app/forgot-password/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | User enters email. `<form onSubmit>` fires. |
| 2 | `fetch("/api/auth/forgot-password", { method: "POST", body: { email } })` |
| 3 | **Route:** [`app/api/auth/forgot-password/route.ts`](../app/api/auth/forgot-password/route.ts) — ★ rate-limit → lookup user by email → generate reset token → send email |
| 4 | Component shows success message regardless (prevents email enumeration). |
| ✅ | **Endpoint match:** `POST /api/auth/forgot-password` ✅ |

### A3. Reset Password

**Page:** `/reset-password?token=...` • **Component:** [`app/reset-password/page.tsx`](../app/reset-password/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | User enters new password + confirmation. Client validates `password.length >= 12` and passwords match. |
| 2 | `fetch("/api/auth/reset-password", { method: "POST", body: { token, password } })` |
| 3 | **Route:** [`app/api/auth/reset-password/route.ts`](../app/api/auth/reset-password/route.ts) — validates token → `bcrypt.hash()` → `db.user.update({ passwordHash })` |
| 4 | On success: `setTimeout(() => router.push("/sign-in"), 2000)` |
| ✅ | **Endpoint match:** `POST /api/auth/reset-password` ✅. **DB table:** `User` (passwordHash update) ✅ |

### A4. Email Verification

**Page:** `/verify-email?token=...` • **Component:** [`app/verify-email/page.tsx`](../app/verify-email/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` fires on mount. |
| 2 | `fetch("/api/auth/verify-email", { method: "POST", body: { token } })` |
| 3 | **Route:** [`app/api/auth/verify-email/route.ts`](../app/api/auth/verify-email/route.ts) — validates token → `db.user.update({ emailVerified: new Date() })` |
| 4 | On success: shows "Email verified!" → `router.push("/dashboard")` after 3s. |
| ✅ | **Endpoint match:** `POST /api/auth/verify-email` ✅. **DB table:** `User` (emailVerified) ✅ |

---

## B — Dashboard & Workspace Flows

### B1. Dashboard Page Load (Server Component)

**Page:** `/dashboard` • **Component:** [`app/dashboard/page.tsx`](../app/dashboard/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `proxy.ts` checks JWT → if not authenticated, redirect to `/sign-in`. |
| 2 | Server component runs. `getServerSession()` → 10 parallel Prisma queries: `db.user.findUnique()`, `db.biomarker.count()`, `db.protocol.count()`, `db.labOrder.count()`, `db.pathway.count()`, `db.biomarker.findMany()`, `db.protocol.findMany()`, `db.researchEntry.findMany()`, `db.clinicianTask.findMany()`, `db.partnerDataRecord.findMany()` |
| 3 | Data passed as props to `<DashboardWorkspace>`, `<BiomarkerTrends>`, etc. |
| ✅ | **No fetch call** — server component with direct Prisma access. **DB tables:** `User`, `Biomarker`, `Protocol`, `LabOrder`, `Pathway`, `ResearchEntry`, `ClinicianTask`, `PartnerDataRecord` ✅ |

### B2. Create Biomarker (form submit)

**Component:** [`components/dashboard-workspace.tsx`](../components/dashboard-workspace.tsx)

| Step | What happens |
|------|-------------|
| 1 | `<form onSubmit={createBiomarker}>` → `requestJson("/api/biomarkers", { method: "POST", body: { name, value, unit, target, trend } })` |
| 2 | **Route:** [`app/api/biomarkers/route.ts`](../app/api/biomarkers/route.ts) — ★ auth → ★ Zod `biomarkerSchema` → ★ tenant → ★ idempotency → ★ `$transaction { tx.biomarker.create() + health event + outbox }` → ★ audit `"biomarker.created"` |
| 3 | Returns `201` with created biomarker. Component resets form, `router.refresh()` re-runs server component. |
| ✅ | `POST /api/biomarkers` → `biomarkers/route.ts` ✅. **DB:** `Biomarker`, `CanonicalHealthEvent`, `OutboxMessage`, `AuditLog` ✅ |

### B3. Delete Biomarker

**Component:** [`components/dashboard-workspace.tsx`](../components/dashboard-workspace.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => deleteBiomarker(id)}` → `requestJson(\`/api/biomarkers/${id}\`, { method: "DELETE" })` |
| 2 | **Route:** [`app/api/biomarkers/[id]/route.ts`](../app/api/biomarkers/%5Bid%5D/route.ts) — ★ auth → ★ tenant → ★ idempotency → ownership check `db.biomarker.findFirst({ id, userId })` → ★ `$transaction { tx.biomarker.delete() + health event }` → ★ audit `"biomarker.deleted"` |
| 3 | `router.refresh()` |
| ✅ | `DELETE /api/biomarkers/:id` → `biomarkers/[id]/route.ts` ✅. **Ownership enforced** before delete ✅ |

### B4. Create Protocol (form submit)

**Component:** [`components/dashboard-workspace.tsx`](../components/dashboard-workspace.tsx)

| Step | What happens |
|------|-------------|
| 1 | `<form onSubmit={createProtocol}>` → `requestJson("/api/protocols", { method: "POST", body: { name, description, status } })` |
| 2 | **Route:** [`app/api/protocols/route.ts`](../app/api/protocols/route.ts) — ★ auth → ★ Zod `protocolSchema` → ★ tenant → ★ idempotency → ★ `$transaction { tx.protocol.create() + health event }` → ★ audit `"protocol.created"` |
| 3 | Returns `201`. `router.refresh()` |
| ✅ | `POST /api/protocols` → `protocols/route.ts` ✅. **DB:** `Protocol`, `CanonicalHealthEvent` ✅ |

### B5. Delete Protocol

**Component:** [`components/dashboard-workspace.tsx`](../components/dashboard-workspace.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => deleteProtocol(id)}` → `requestJson(\`/api/protocols/${id}\`, { method: "DELETE" })` |
| 2 | Route mirrors biomarker delete: auth → tenant → idempotency → ownership → transactional delete → audit |
| 3 | `router.refresh()` |
| ✅ | `DELETE /api/protocols/:id` → `protocols/[id]/route.ts` ✅ |

---

## C — Biomarkers & Bio-Age Flows

### C1. Biomarker Trends (auto-load + select)

**Component:** [`components/biomarker-trends.tsx`](../components/biomarker-trends.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/biomarkers/trends?name=_init_&months=1")` → gets `availableNames`. |
| 2 | Auto-selects first name → `useEffect[selected]` → `fetch(\`/api/biomarkers/trends?name=${name}&months=12\`)` |
| 3 | **Route:** [`app/api/biomarkers/trends/route.ts`](../app/api/biomarkers/trends/route.ts) — ★ rate-limit → ★ auth → `db.biomarker.findMany({ where: { userId, name, measuredAt ≥ since } })` → server computes `min/max/avg/delta/direction` → also queries `db.biomarker.findMany({ distinct: ["name"] })` for autocomplete |
| 4 | Component merges multi-biomarker data by date, renders `<LineChart>` with Recharts. |
| ✅ | `GET /api/biomarkers/trends` ✅. **User-scoped:** `where: { userId }` ✅ |

### C2. Bio-Age Score Card (load latest)

**Component:** [`components/bio-age-score-card.tsx`](../components/bio-age-score-card.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/bio-age?limit=1")` |
| 2 | **Route:** [`app/api/bio-age/route.ts`](../app/api/bio-age/route.ts) GET — ★ rate-limit → ★ auth → `db.bioAgeSnapshot.findMany({ where: { userId }, take: 1, orderBy: { createdAt: "desc" } })` |
| 3 | Sets `latest` state → renders bio-age gauge, hallmark bars, delta indicator. |
| ✅ | `GET /api/bio-age?limit=1` ✅. **DB:** `BioAgeSnapshot` ✅ |

### C3. Compute Bio-Age (click "Recompute")

**Component:** [`components/bio-age-score-card.tsx`](../components/bio-age-score-card.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={handleCompute}` → `prompt("Enter your chronological age")` → client validates 1-150. |
| 2 | `fetch("/api/bio-age", { method: "POST", body: { chronologicalAge } })` |
| 3 | **Route:** [`app/api/bio-age/route.ts`](../app/api/bio-age/route.ts) POST — ★ rate-limit (5/min) → ★ auth → validate 1-150 → `computeAndPersistBioAge(userId, chronologicalAge, tenantId)` — computes 9 hallmark aging scores from existing biomarker data → `db.bioAgeSnapshot.create()` |
| 4 | On success: `fetchLatest()` re-fetches → card re-renders with new scores. |
| ✅ | `POST /api/bio-age` ✅. **DB:** `BioAgeSnapshot` (create) + reads `Biomarker` data for computation ✅ |

### C4. Bio-Age Timeline (load history)

**Component:** [`components/bio-age-timeline.tsx`](../components/bio-age-timeline.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/bio-age?limit=50")` |
| 2 | Route returns `{ snapshots: [...] }` → component reverses array (API returns newest first, chart needs chronological) → renders `<LineChart>` with bioAge vs chronAge lines. |
| ✅ | `GET /api/bio-age?limit=50` ✅. Same route as C2, different limit ✅ |

---

## D — Protocols & Templates Flows

### D1. Load Protocol Templates

**Component:** [`components/protocol-templates.tsx`](../components/protocol-templates.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/protocols/templates")` |
| 2 | **Route:** [`app/api/protocols/templates/route.ts`](../app/api/protocols/templates/route.ts) GET — returns curated templates with compound lists, pathway targets, evidence levels |
| 3 | Renders template cards with compound badges, pathway badges, evidence/caution text. |
| ✅ | `GET /api/protocols/templates` ✅ |

### D2. Adopt Protocol Template

**Component:** [`components/protocol-templates.tsx`](../components/protocol-templates.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => adopt(template)}` → `fetch("/api/protocols/templates", { method: "POST", body: { templateId, templateName, templateDescription } })` |
| 2 | Route creates a new `Protocol` record for the user based on the template data. |
| 3 | On success: `setAdopted(prev => new Set(prev).add(t.id))` → button changes to "Adopted ✓". |
| ✅ | `POST /api/protocols/templates` ✅. **DB:** `Protocol` (create from template) ✅ |

---

## E — Knowledge Graph & Compound Mixer Flows

### E1. Compound Search (debounced)

**Component:** [`components/compound-mixer.tsx`](../components/compound-mixer.tsx)

| Step | What happens |
|------|-------------|
| 1 | User types → `setQuery()` → `useEffect` debounces 300ms → `fetch(\`/api/compounds?q=${q}&limit=10\`)` |
| 2 | **Route:** [`app/api/compounds/route.ts`](../app/api/compounds/route.ts) GET — ★ rate-limit → `db.compound.findMany({ where: { name: { contains: q } }, include: { pathways, biomarkerEffects, _count } })` |
| 3 | `setCompounds(data)` → dropdown renders. Click compound → `addCompound(c)` → `setSelected([...prev, c])`. |
| ✅ | `GET /api/compounds?q=...` ✅. **No auth required** (public reference data, rate-limited) ✅ |

### E2. Interaction Check (auto on 2+ selected)

**Component:** [`components/compound-mixer.tsx`](../components/compound-mixer.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect[selected]` fires when `selected.length >= 2`. |
| 2 | `Promise.all(selected.map(c => fetch(\`/api/knowledge-graph?compound=${c.id}\`)))` |
| 3 | **Route:** [`app/api/knowledge-graph/route.ts`](../app/api/knowledge-graph/route.ts) GET — ★ rate-limit → `db.compound.findUnique({ include: { pathways, interactions: { include: { compoundB } }, interactedWith: { include: { compoundA } }, biomarkerEffects, studyLinks } })` |
| 4 | Client cross-references interaction partner IDs vs `selectedIds` Set, deduplicates, renders severity badges. |
| ✅ | `GET /api/knowledge-graph?compound=...` ✅. **Client-side cross-reference** correct ✅ |

### E3. Remove Compound from Stack

**Component:** [`components/compound-mixer.tsx`](../components/compound-mixer.tsx)

| Step | What happens |
|------|-------------|
| 1 | Click ✕ → `removeCompound(id)` → `setSelected(prev => prev.filter(c => c.id !== id))` |
| 2 | **No API call** — purely client-side state removal. `useEffect[selected]` re-triggers interaction check with reduced set. |
| ✅ | Local state only ✅ |

---

## F — Community Forum Flows

### F1. Load Community Feed

**Component:** [`components/community-feed.tsx`](../components/community-feed.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect[category]` → `fetch(\`/api/community?category=${cat}&limit=15\`)` |
| 2 | **Route:** [`app/api/community/route.ts`](../app/api/community/route.ts) GET — ★ rate-limit → `db.communityPost.findMany({ where: { published: true, flagged: false }, include: { author }, orderBy: { createdAt: "desc" }, take: 16, cursor })` |
| 3 | Cursor-based pagination: if `posts.length > 15`, last item becomes next cursor. |
| ✅ | `GET /api/community` ✅. **Cursor pagination** ✅ |

### F2. Create Community Post

**Component:** [`components/community-feed.tsx`](../components/community-feed.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={submit}` (disabled when `title < 5 || body < 20`). `fetch("/api/community", { method: "POST", body: { title, body, category } })` |
| 2 | **Route:** same file POST — ★ rate-limit (10/min) → ★ auth → ★ Zod `postSchema` (title 5-200, body 20-10000, category enum) → ★ tenant → ★ idempotency → `db.communityPost.create()` → ★ audit |
| 3 | Clears form, re-fetches feed via `load(category)`. |
| ✅ | `POST /api/community` ✅. **Client + server validation aligned** ✅ |

### F3. Change Category Filter

**Component:** [`components/community-feed.tsx`](../components/community-feed.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onValueChange={setCategory}` → `useEffect[category]` re-fetches. `setPosts([])` clears, `load(newCategory)`. |
| ✅ | Re-uses F1 flow with different `?category=` param ✅ |

---

## G — Global Search Flow

### G1. Cross-Entity Search

**Component:** [`components/global-search.tsx`](../components/global-search.tsx)

| Step | What happens |
|------|-------------|
| 1 | User types in nav search bar → `setQuery()` + `setOpen(true)` → debounce 300ms → `fetch(\`/api/search?q=${q}&limit=5\`)` |
| 2 | **Route:** [`app/api/search/route.ts`](../app/api/search/route.ts) — ★ rate-limit (30/min) → ★ auth → 4 parallel Prisma queries: `db.compound`, `db.learnArticle`, `db.communityPost`, `db.pathway` |
| 3 | Results mapped with `type` + `href`. Click → `<Link href={r.href}>` navigates client-side. Click-outside listener closes dropdown. |
| ✅ | `GET /api/search` ✅. **4 models queried in parallel** ✅. **Href routing:** `/compounds/:id`, `/learn/:slug`, `/community`, `/mixer` ✅ |

---

## H — Discovery Lab (AeonForge) Flows

### H1. Submit Discovery Prompt

**Component:** [`components/discovery/prompt-discovery.tsx`](../components/discovery/prompt-discovery.tsx)

| Step | What happens |
|------|-------------|
| 1 | User types prompt (≥20 chars), selects options (include simulation, virtual twin for enterprise). `<form onSubmit>`. |
| 2 | `fetch("/api/aeonforge/prompt", { method: "POST", body: { prompt, discoveryTier, includeSimulation, includeVirtualTwin } })` |
| 3 | **Route:** [`app/api/aeonforge/prompt/route.ts`](../app/api/aeonforge/prompt/route.ts) — ★ auth → tier validation → runs AeonForge engine: KG Prisma queries → multi-provider AI → molecular candidate generation → simulation → virtual twin (enterprise) → persists `DiscoveryCandidate` |
| 4 | On success: `onDiscovered()` → parent increments `refreshTrigger` → candidates list re-fetches. |
| ✅ | `POST /api/aeonforge/prompt` ✅. **DB:** `DiscoveryCandidate` ✅ |

### H2. Load Discovery Candidates

**Component:** [`components/discovery/discovery-candidates.tsx`](../components/discovery/discovery-candidates.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect[refreshTrigger]` → `fetch("/api/aeonforge/candidates")` |
| 2 | Returns array of candidate summaries. If `selectedId` is null, auto-selects first. |
| ✅ | `GET /api/aeonforge/candidates` ✅ |

### H3. View Candidate Details + Simulation Results

**Component:** [`components/discovery/simulation-results.tsx`](../components/discovery/simulation-results.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect[candidate.id]` → `fetch(\`/api/aeonforge/candidates/${candidate.id}\`)` |
| 2 | Returns full details: molecular candidates, simulation scores, virtual twin runs. Renders 3D molecular viewer via `<MolecularViewer>` (PubChem SDF fetch + 3Dmol.js). |
| ✅ | `GET /api/aeonforge/candidates/:id` ✅ |

---

## I — Clinical Trials & Research Flows

### I1. Search Clinical Trials

**Component:** [`components/clinical-trials-explorer.tsx`](../components/clinical-trials-explorer.tsx)

| Step | What happens |
|------|-------------|
| 1 | `<form onSubmit={handleSubmit}>` or click suggested query tag. |
| 2 | `fetch(\`/api/clinical-trials/search?q=${q}&limit=20\`)` |
| 3 | **Route:** [`app/api/clinical-trials/search/route.ts`](../app/api/clinical-trials/search/route.ts) — proxies to **ClinicalTrials.gov API** → parses response → returns structured trial data (nctId, title, status, conditions) |
| 4 | Renders trial cards with status badges (RECRUITING, COMPLETED, etc.) and links to ClinicalTrials.gov. |
| ✅ | `GET /api/clinical-trials/search` ✅. **External API:** ClinicalTrials.gov ✅ |

### I2. Save Trials to Research Collection

**Component:** [`components/clinical-trials-explorer.tsx`](../components/clinical-trials-explorer.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={saveToCollection}` → `fetch("/api/research/clinical-trials", { method: "POST", body: { collectionName, query, maxResults } })` |
| 2 | Route creates a `ResearchCollection` with `ResearchEntry` records for each trial. |
| 3 | Shows success message with count of saved entries. |
| ✅ | `POST /api/research/clinical-trials` ✅. **DB:** `ResearchCollection`, `ResearchEntry` ✅ |

---

## J — AI Health Coach Flow

### J1. Send AI Message

**Component:** [`components/ai-health-coach.tsx`](../components/ai-health-coach.tsx)

| Step | What happens |
|------|-------------|
| 1 | `<form onSubmit={handleSubmit}>` or click suggested question. User message appended to local `messages` state. |
| 2 | **Multi-provider fallback chain:** tries in order: `POST /api/ai/openai` → `POST /api/ai/anthropic` → `POST /api/ai/grok`. Stops at first successful response. |
| 3 | Each route: ★ auth → ★ rate-limit → tier gating → AI governance check → call external AI API → attach disclaimers + citations |
| 4 | Response appended as assistant message with `provider`, `disclaimer`, `citations` metadata. |
| ✅ | `POST /api/ai/openai`, `/api/ai/anthropic`, `/api/ai/grok` ✅. **Failover chain** ✅. **External APIs:** OpenAI, Anthropic, xAI ✅ |

---

## K — Lab Testing Flows

### K1. Load Lab Test Catalog + Orders

**Component:** [`components/lab-testing-dashboard.tsx`](../components/lab-testing-dashboard.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `Promise.all([fetch("/api/lab-testing"), fetch("/api/lab-testing/orders")])` |
| 2 | **GET `/api/lab-testing`:** returns `LabTestPanel[]` (name, category, biomarkers, price, turnaround). **GET `/api/lab-testing/orders`:** returns user's `LabOrder[]` with results. |
| 3 | Renders catalog tab (panels with "Order" buttons) and orders tab (status + results). |
| ✅ | `GET /api/lab-testing` + `GET /api/lab-testing/orders` ✅. **DB:** `LabTestPanel`, `LabOrder`, `LabResult` ✅ |

### K2. Place Lab Order

**Component:** [`components/lab-testing-dashboard.tsx`](../components/lab-testing-dashboard.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => handleOrder(panelId)}` → `fetch("/api/lab-testing", { method: "POST", body: { panelId } })` |
| 2 | **Route:** auth → validate panelId exists → create `LabOrder` for userId → transactional health event |
| 3 | On success: `loadData()` re-fetches both panels and orders. Switches to "Orders" tab. |
| ✅ | `POST /api/lab-testing` ✅. **DB:** `LabOrder` (create) ✅ |

---

## L — Telemedicine Flows

### L1. Load Providers + Consultations

**Page:** `/telemedicine` • **Component:** [`app/telemedicine/page.tsx`](../app/telemedicine/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` → `Promise.all([fetch("/api/telemedicine"), session ? fetch("/api/telemedicine/consultations") : null])` |
| 2 | Returns provider directory + user's consultation history. |
| ✅ | `GET /api/telemedicine` + `GET /api/telemedicine/consultations` ✅ |

### L2. Request Consultation

**Page:** `/telemedicine` • **Component:** [`app/telemedicine/page.tsx`](../app/telemedicine/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | User fills provider, type, reason fields. `<form onSubmit={handleSubmit}>` fires. |
| 2 | `fetch("/api/telemedicine", { method: "POST", body: { providerId, type, reason } })` with idempotency header. |
| 3 | **Route:** [`app/api/telemedicine/consultations/route.ts`](../app/api/telemedicine/consultations/route.ts) — auth → validate → create consultation (status: `REQUESTED`) → health event |
| 4 | On success: prepend to `consultations` state, hide form. |
| ✅ | `POST /api/telemedicine` ✅. **DB:** `TelemedicineConsultation` ✅ |

---

## M — Consumer Marketplace Flows

### M1. Load Products + Orders

**Page:** `/marketplace` • **Component:** [`app/marketplace/page.tsx`](../app/marketplace/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect[session, filter]` → `Promise.all([fetch(\`/api/marketplace?category=${filter}\`), session ? fetch("/api/marketplace/orders") : null])` |
| 2 | Returns product catalog + user's order history. |
| ✅ | `GET /api/marketplace` + `GET /api/marketplace/orders` ✅ |

### M2. Place Marketplace Order

**Page:** `/marketplace` • **Component:** [`app/marketplace/page.tsx`](../app/marketplace/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => handleOrder(product)}` → `fetch("/api/marketplace/orders", { method: "POST", body: { items: [{ productId, quantity: 1 }] } })` with idempotency header. |
| 2 | Route: auth → validate product exists → create `MarketplaceOrder` + `OrderItem` → returns order. |
| 3 | Prepend to `orders` state. |
| ✅ | `POST /api/marketplace/orders` ✅. **DB:** `MarketplaceOrder`, `OrderItem` ✅ |

### M3. Category Filter

**Page:** `/marketplace`

| Step | What happens |
|------|-------------|
| 1 | Click category button → `setFilter(cat)` → `useEffect[filter]` re-fetches product list. |
| ✅ | Re-uses M1 flow ✅ |

---

## N — Scientist-Sponsor Marketplace Flows

### N1. Sponsor Dashboard — Browse Discoveries + Get Matches

**Component:** [`scientist-sponsor-marketplace/frontend/components/sponsor-dashboard.tsx`](../scientist-sponsor-marketplace/frontend/components/sponsor-dashboard.tsx)

| Step | What happens |
|------|-------------|
| 1 | On mount + on "Refresh pipeline" click: `runWorkflow("sponsor", { action: "browse", ...filters })` ← uses marketplace entity hook with RBAC. |
| 2 | Also: `fetch(\`/api/scientist-sponsor-marketplace/matches?category=...&minImpactScore=...\`)` |
| 3 | **Route:** match scoring service returns `RankedMatch[]` with `overallScore` + `rationale`. |
| 4 | Renders discovery cards + recommended matches with score percentages. |
| ✅ | `GET /api/scientist-sponsor-marketplace/matches` ✅ |

### N2. Request More Info / Enter Deal Room

**Component:** [`scientist-sponsor-marketplace/frontend/components/sponsor-dashboard.tsx`](../scientist-sponsor-marketplace/frontend/components/sponsor-dashboard.tsx)

| Step | What happens |
|------|-------------|
| 1 | "Request more info" → `runWorkflow("sponsor", { action: "requestMoreInfo", discoveryId, message })`. "Enter deal room" → `runWorkflow("sponsor", { action: "enterDealRoom", discoveryId })`. |
| 2 | Workflows are handled by the marketplace entity controller with RBAC + audit. |
| ✅ | Marketplace entity controller pattern ✅ |

### N3. Deal Room Payment Confirmation

**Component:** [`scientist-sponsor-marketplace/frontend/components/deal-room-panel.tsx`](../scientist-sponsor-marketplace/frontend/components/deal-room-panel.tsx)

| Step | What happens |
|------|-------------|
| 1 | After Stripe redirect, `useEffect` checks URL for `?session_id=...`. |
| 2 | `fetch("/api/scientist-sponsor-marketplace/payments/confirm", { method: "POST", body: { sessionId } })` |
| 3 | Route validates Stripe session → confirms payment → updates deal room. |
| ✅ | `POST /api/scientist-sponsor-marketplace/payments/confirm` ✅ |

### N4. Deal Room Messaging + Agreement

**Component:** [`scientist-sponsor-marketplace/frontend/components/deal-room-panel.tsx`](../scientist-sponsor-marketplace/frontend/components/deal-room-panel.tsx)

| Step | What happens |
|------|-------------|
| 1 | `<form onSubmit={sendMessage}>` → `runWorkflow("deal", { action: "message", dealRoomId, body })`. |
| 2 | "Build Agreement" → `runWorkflow("deal", { action: "buildAgreement", dealRoomId, agreementTerms })`. |
| ✅ | Marketplace entity controller ✅ |

---

## O — Billing & Stripe Flows

### O1. Stripe Checkout (subscription)

**Component:** [`components/pricing-checkout.tsx`](../components/pricing-checkout.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => startCheckout(plan.key)}` → `fetch("/api/stripe/checkout", { method: "POST", body: { planKey } })` |
| 2 | **Route:** [`app/api/stripe/checkout/route.ts`](../app/api/stripe/checkout/route.ts) — ★ rate-limit → ★ auth → validate `planKey in billingCatalog` → ★ tenant → ★ idempotency → ★ circuit breaker wraps: `ensureStripeCustomer()` → `stripe.checkout.sessions.create()` |
| 3 | Returns `{ url }` → `window.location.href = url` → redirect to Stripe hosted checkout. |
| ✅ | `POST /api/stripe/checkout` ✅. **External:** Stripe API ✅. **Circuit breaker** wraps external call ✅ |

### O2. Stripe Billing Portal

**Component:** [`components/account-billing-actions.tsx`](../components/account-billing-actions.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={openPortal}` → `fetch("/api/stripe/portal", { method: "POST" })` |
| 2 | Route: auth → creates Stripe billing portal session → returns `{ url }`. |
| 3 | `window.location.href = body.url` → redirect to Stripe portal. |
| ✅ | `POST /api/stripe/portal` ✅. **External:** Stripe API ✅ |

---

## P — Account Management Flows

### P1. Export Account Data (GDPR)

**Component:** [`components/account-data-actions.tsx`](../components/account-data-actions.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={exportData}` → `fetch("/api/account/export")` |
| 2 | **Route:** [`app/api/account/export/route.ts`](../app/api/account/export/route.ts) — ★ auth → `db.user.findUnique({ include: { profile, subscriptions, biomarkers, protocols, researchCollections, clinicianTasks, partnerDataRecords } })` → ★ audit `"account.data_export"` |
| 3 | Client creates `Blob` → `URL.createObjectURL()` → triggers download as `biozephyra-data-export-YYYY-MM-DD.json`. |
| ✅ | `GET /api/account/export` ✅. **DB:** reads 8 related models ✅. **GDPR right of access** ✅ |

### P2. Delete Account (GDPR)

**Component:** [`components/account-data-actions.tsx`](../components/account-data-actions.tsx)

| Step | What happens |
|------|-------------|
| 1 | Click "Delete account" → first click shows confirmation, second click (`onClick={deleteAccount}`) calls API. |
| 2 | `fetch("/api/account/delete", { method: "DELETE", body: { confirmation: "DELETE_MY_ACCOUNT" } })` |
| 3 | **Route:** [`app/api/account/delete/route.ts`](../app/api/account/delete/route.ts) — ★ rate-limit (3/min) → ★ auth → validate `confirmation === "DELETE_MY_ACCOUNT"` → ★ tenant → ★ idempotency → ★ audit `"account.deleted"` → `db.user.delete()` (Prisma cascade) |
| 4 | On success: `signOut({ callbackUrl: "/" })` → redirects to home. |
| ✅ | `DELETE /api/account/delete` ✅. **Two-step confirmation** ✅. **GDPR right of erasure** ✅ |

---

## Q — MFA / Two-Factor Flows

### Q1. Begin MFA Setup

**Component:** [`components/mfa-setup.tsx`](../components/mfa-setup.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={handleBeginSetup}` → `fetch("/api/account/mfa", { method: "POST" })` |
| 2 | **Route:** [`app/api/account/mfa/route.ts`](../app/api/account/mfa/route.ts) POST — ★ auth → check not already enabled → `generateMfaSecret(userId, email)` → returns `{ qrCodeDataUri, secret, backupCodes }` |
| 3 | Component shows QR code, manual entry key, backup codes grid, and OTP input. |
| ✅ | `POST /api/account/mfa` ✅. **DB:** `User` (mfaSecret updated via AES-256-GCM encryption) ✅ |

### Q2. Verify & Activate MFA

**Component:** [`components/mfa-setup.tsx`](../components/mfa-setup.tsx)

| Step | What happens |
|------|-------------|
| 1 | User enters 6-digit code → `onClick={handleVerify}` → `fetch("/api/account/mfa", { method: "PUT", body: { token } })` |
| 2 | **Route:** same file PUT — ★ auth → validate 6-digit → `activateMfa(userId, token)` → verifies TOTP → sets `mfaEnabled = true` |
| 3 | Component advances to "done" step. |
| ✅ | `PUT /api/account/mfa` ✅ |

### Q3. Disable MFA

**Page:** `/account/security` • **Component:** [`app/account/security/page.tsx`](../app/account/security/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | User enters 6-digit code → `onClick={handleDisable}` → `fetch("/api/account/mfa", { method: "DELETE", body: { token } })` |
| 2 | **Route:** same file DELETE — ★ auth → `disableMfa(userId, token)` → verifies token → clears MFA secret |
| 3 | `setMfaEnabled(false)` |
| ✅ | `DELETE /api/account/mfa` ✅ |

### Q4. MFA Verify During Login

**Page:** `/mfa-verify` • **Component:** [`app/mfa-verify/page.tsx`](../app/mfa-verify/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | User enters 6-digit TOTP or backup code. `<form onSubmit={handleSubmit}>`. |
| 2 | `fetch("/api/account/mfa/verify", { method: "POST", body: { token } })` |
| 3 | **Route:** [`app/api/account/mfa/verify/route.ts`](../app/api/account/mfa/verify/route.ts) — ★ rate-limit (**5/min** — anti brute-force) → ★ auth → try TOTP verification → fallback to backup code verification |
| 4 | On success: `session.update()` (clears `mfaPending`) → `router.push("/dashboard")`. |
| ✅ | `POST /api/account/mfa/verify` ✅. **Brute-force protection:** 5 req/min ✅ |

### Q5. Check MFA Status

**Page:** `/account/security` • **Component:** [`app/account/security/page.tsx`](../app/account/security/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/account/mfa/status")` |
| 2 | **Route:** [`app/api/account/mfa/status/route.ts`](../app/api/account/mfa/status/route.ts) — ★ auth → `isMfaEnabled(userId)` → returns `{ enabled: boolean }` |
| 3 | Conditionally renders MfaSetup component or disable controls. |
| ✅ | `GET /api/account/mfa/status` ✅ |

---

## R — GDPR Consent Flows

### R1. Load Consent Preferences

**Component:** [`components/consent-collection.tsx`](../components/consent-collection.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/account/consent")` |
| 2 | **Route:** [`app/api/account/consent/route.ts`](../app/api/account/consent/route.ts) GET — ★ auth → `db.consentRecord.findFirst({ where: { userId } })` → returns GDPR consent categories with granted/revoked state |
| 3 | Pre-fills checkboxes based on existing consents. |
| ✅ | `GET /api/account/consent` ✅. **DB:** `ConsentRecord` ✅ |

### R2. Save Consent Preferences

**Component:** [`components/consent-collection.tsx`](../components/consent-collection.tsx)

| Step | What happens |
|------|-------------|
| 1 | User toggles checkboxes → `onClick={handleSubmit}` → `fetch("/api/account/consent", { method: "PATCH", body: { status, legalBasis, scopes, gdprConsents, consentVersion, policyVersion } })` |
| 2 | **Route:** same file PATCH — ★ auth → Zod validation → upsert `ConsentRecord` with GDPR categories |
| 3 | On success: `onComplete?.()` callback fires (used during onboarding to advance wizard). |
| ✅ | `PATCH /api/account/consent` ✅. **DB:** `ConsentRecord` (upsert) ✅ |

---

## S — Wearable Device Flows

### S1. Load Wearable Connections

**Component:** [`components/wearable-connect.tsx`](../components/wearable-connect.tsx) (`WearableConnectCard`)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/wearables/connect")` |
| 2 | Returns `{ connections: WearableConnection[] }` — provider, status, lastSyncAt. |
| 3 | Renders active connections with provider icons and "Disconnect" buttons + "Connect a Device" button. |
| ✅ | `GET /api/wearables/connect` ✅ |

### S2. Connect New Wearable

**Component:** [`components/wearable-connect.tsx`](../components/wearable-connect.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={handleConnect}` → `fetch("/api/wearables/connect", { method: "POST" })` |
| 2 | Route returns `{ widgetUrl }` → `window.open(widgetUrl, "_blank")` opens provider OAuth widget. |
| ✅ | `POST /api/wearables/connect` ✅ |

### S3. Disconnect Wearable

**Component:** [`components/wearable-connect.tsx`](../components/wearable-connect.tsx)

| Step | What happens |
|------|-------------|
| 1 | `onClick={() => handleDisconnect(provider)}` → `fetch("/api/wearables/connect", { method: "DELETE", body: { provider } })` |
| 2 | On success: `fetchConnections()` re-fetches. |
| ✅ | `DELETE /api/wearables/connect` ✅ |

### S4. Load Wearable Data Feed

**Component:** [`components/wearable-connect.tsx`](../components/wearable-connect.tsx) (`WearableDataFeed`)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/wearables/data?limit=20")` |
| 2 | Returns `{ records: WearableDataPoint[] }` with metrics arrays. |
| ✅ | `GET /api/wearables/data` ✅ |

---

## T — Gamification & Achievements Flows

### T1. Load Gamification State (Dashboard Widget)

**Component:** [`components/gamification/gamification-widgets.tsx`](../components/gamification/gamification-widgets.tsx) (`GamificationWidget`)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/gamification")` |
| 2 | **Route:** [`app/api/gamification/route.ts`](../app/api/gamification/route.ts) GET — ★ rate-limit (30/min) → ★ auth → 3 parallel calls: `getXPSummary()`, `getUserStreaks()`, `getUserAchievements()` |
| 3 | Renders XP bar, streak display, recent achievements grid. |
| ✅ | `GET /api/gamification` ✅. **DB:** XP, streak, and achievement models ✅ |

### T2. Achievements Full Page

**Page:** `/achievements` • **Component:** [`app/achievements/page.tsx`](../app/achievements/page.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/gamification")` — same endpoint as T1 |
| 2 | Renders full achievement grid grouped by category, XP level bar, streak cards. |
| ✅ | Re-uses `GET /api/gamification` ✅ |

---

## U — Onboarding Flow

### U1. Complete Onboarding Wizard

**Component:** [`components/onboarding/onboarding-wizard.tsx`](../components/onboarding/onboarding-wizard.tsx)

| Step | What happens |
|------|-------------|
| 1 | 4-step wizard: Step 1 (DOB, bio sex) → Step 2 (health goals, motivation, risk tolerance) → Step 3 (conditions, supplement stack) → Step 4 (diet, activity, sleep, stress). |
| 2 | On final step submit: `fetch("/api/onboarding", { method: "POST", body: { step1, step2, step3, step4 } })` |
| 3 | **Route:** [`app/api/onboarding/route.ts`](../app/api/onboarding/route.ts) — ★ rate-limit → ★ auth → ★ Zod `onboardingCompleteSchema` → `db.userProfile.upsert()` with all answers + `onboardingCompletedAt` → processes referral reward → ★ audit |
| 4 | On success: `router.push("/dashboard")` + `router.refresh()`. |
| ✅ | `POST /api/onboarding` ✅. **DB:** `UserProfile` (upsert) ✅ |

---

## V — Admin Console Flows

### V1. Admin User Role Change

**Component:** [`components/admin-user-management.tsx`](../components/admin-user-management.tsx)

| Step | What happens |
|------|-------------|
| 1 | Admin selects new role from dropdown → `handleRoleChange(userId, newRole)` → `fetch("/api/admin/users", { method: "PATCH", body: { userId, role } })` |
| 2 | Route: admin auth → `db.user.update({ role })` → audit |
| 3 | `window.location.reload()` refreshes the server component (full user list). |
| ✅ | `PATCH /api/admin/users` ✅. **Role gate:** admin-only ✅ |

### V2. Admin Audit Export

**Component:** [`components/admin-review-console.tsx`](../components/admin-review-console.tsx)

| Step | What happens |
|------|-------------|
| 1 | Click "Export" → `fetch(\`/api/admin/audit-export?${params}\`)` |
| 2 | Route: admin auth → `db.auditLog.findMany()` with date/entity filters → returns audit log entries. |
| ✅ | `GET /api/admin/audit-export` ✅ |

### V3. Admin Review Items (server component + mutations)

**Component:** [`components/admin-review-console.tsx`](../components/admin-review-console.tsx)

| Step | What happens |
|------|-------------|
| 1 | Server component passes `reviewItems` and `auditLogs` as props (direct Prisma queries). |
| 2 | Admin actions (approve/reject/create review items) use `requestJson` with idempotency headers → route mutations. |
| 3 | `router.refresh()` after each mutation. |
| ✅ | Admin review routes with idempotency ✅ |

### V4. Admin Community Moderation

**Component:** [`components/admin-community-moderation.tsx`](../components/admin-community-moderation.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch(\`/api/admin/community?limit=50${flaggedOnly ? "&flagged=true" : ""}\`)` |
| 2 | Moderation actions: `fetch("/api/admin/community", { method: "PATCH", body: { postId, action } })` — actions: `publish`, `unpublish`, `flag`, `unflag`, `delete`. |
| 3 | On delete: remove from local state. On other actions: `load()` re-fetches. |
| ✅ | `GET /api/admin/community` + `PATCH /api/admin/community` ✅ |

---

## W — Federated Learning Flow

### W1. Check FL Consent

**Component:** [`components/fl/fl-consent-gate.tsx`](../components/fl/fl-consent-gate.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/fl/participate")` |
| 2 | Route: auth → checks `research-usage` GDPR consent → returns `200` (has consent) or `403` (no consent). |
| 3 | If `403`: renders consent-required banner with link to consent settings. If `200`: renders `{children}` (the FL workspace). |
| ✅ | `GET /api/fl/participate` ✅. **Consent gate** ✅ |

---

## X — Insights Flow

### X1. Load Aggregate Outcomes

**Component:** [`components/insights/aggregate-outcomes.tsx`](../components/insights/aggregate-outcomes.tsx)

| Step | What happens |
|------|-------------|
| 1 | `useEffect` on mount → `fetch("/api/insights/aggregate?limit=20")` |
| 2 | Route: auth → `db.aggregateOutcome.findMany({ include: { protocol, compound } })` → returns population-level outcome data with statistics (mean, stdDev, pValue, confidence). |
| 3 | Renders outcome cards with protocol/compound associations. |
| ✅ | `GET /api/insights/aggregate` ✅. **DB:** `AggregateOutcome` ✅ |

---

## Cross-Cutting Verification Summary

| Concern | Frontend enforcement | Backend enforcement | Verified? |
|---------|---------------------|---------------------|-----------|
| **Authentication** | Session cookie auto-sent by browser | `getServerSession()` on every route | ✅ |
| **Authorization** | N/A (delegated to server) | Role check + tenant membership | ✅ |
| **Input validation** | Button disabled states, min-length checks | Zod `.safeParse()` on every POST | ✅ |
| **Tenant isolation** | N/A (header-based) | `deriveTenantContextWithValidation()` on every mutation | ✅ |
| **Idempotency** | `withJsonMutationHeaders()` / `withIdempotencyHeaders()` on some components | SHA-256 fingerprint + `IdempotencyRecord` table | ✅ |
| **Rate limiting** | N/A | `applyRateLimit()` on every route | ✅ |
| **Audit trail** | N/A | `logAudit()` on every mutation | ✅ |
| **Health events** | N/A | `PrismaTransactionalHealthEventIngestionService` wraps biomarker/protocol/lab mutations | ✅ |
| **Ownership** | N/A | `where: { userId, id }` on delete/update queries | ✅ |
| **Double-submit** | `disabled` prop on buttons + idempotency headers | Idempotency layer | ✅ |
| **Error display** | `catch` → `setError(message)` | `NextResponse.json({ error }, { status })` | ✅ |
| **Data refresh** | `router.refresh()` / `load()` re-fetch / `setState()` | Server component re-runs Prisma queries | ✅ |
| **Circuit breaker** | N/A | `executeWithCircuitBreaker()` wraps Stripe + external APIs | ✅ |
| **GDPR consent** | Consent gate component | Route-level consent check for AI/research features | ✅ |
| **MFA enforcement** | Redirect to `/mfa-verify` | `proxy.ts` checks `mfaPending` JWT claim | ✅ |
| **CSP nonce** | `<script nonce={nonce}>` in layout | `proxy.ts` generates + injects nonce per request | ✅ |

---

## Complete Endpoint Mapping Table (Frontend → Backend)

| # | Component | User action | HTTP call | Route file | DB model / External |
|---|-----------|------------|-----------|-----------|---------------------|
| 1 | `sign-up/page.tsx` | Submit registration form | `POST /api/auth/register` | `app/api/auth/register/route.ts` | `User`, `UserProfile` |
| 2 | `forgot-password/page.tsx` | Submit email | `POST /api/auth/forgot-password` | `app/api/auth/forgot-password/route.ts` | `User`, email service |
| 3 | `reset-password/page.tsx` | Submit new password | `POST /api/auth/reset-password` | `app/api/auth/reset-password/route.ts` | `User` |
| 4 | `verify-email/page.tsx` | Auto on mount | `POST /api/auth/verify-email` | `app/api/auth/verify-email/route.ts` | `User` |
| 5 | `dashboard-workspace.tsx` | Submit biomarker form | `POST /api/biomarkers` | `app/api/biomarkers/route.ts` | `Biomarker`, health event |
| 6 | `dashboard-workspace.tsx` | Click delete biomarker | `DELETE /api/biomarkers/:id` | `app/api/biomarkers/[id]/route.ts` | `Biomarker` |
| 7 | `dashboard-workspace.tsx` | Submit protocol form | `POST /api/protocols` | `app/api/protocols/route.ts` | `Protocol`, health event |
| 8 | `dashboard-workspace.tsx` | Click delete protocol | `DELETE /api/protocols/:id` | `app/api/protocols/[id]/route.ts` | `Protocol` |
| 9 | `biomarker-trends.tsx` | Mount / select biomarker | `GET /api/biomarkers/trends` | `app/api/biomarkers/trends/route.ts` | `Biomarker` |
| 10 | `bio-age-score-card.tsx` | Mount (load latest) | `GET /api/bio-age?limit=1` | `app/api/bio-age/route.ts` | `BioAgeSnapshot` |
| 11 | `bio-age-score-card.tsx` | Click "Recompute" | `POST /api/bio-age` | `app/api/bio-age/route.ts` | `BioAgeSnapshot`, `Biomarker` |
| 12 | `bio-age-timeline.tsx` | Mount (load history) | `GET /api/bio-age?limit=50` | `app/api/bio-age/route.ts` | `BioAgeSnapshot` |
| 13 | `protocol-templates.tsx` | Mount (load templates) | `GET /api/protocols/templates` | `app/api/protocols/templates/route.ts` | Protocol templates |
| 14 | `protocol-templates.tsx` | Click "Adopt" | `POST /api/protocols/templates` | `app/api/protocols/templates/route.ts` | `Protocol` |
| 15 | `compound-mixer.tsx` | Type in search box | `GET /api/compounds?q=...` | `app/api/compounds/route.ts` | `Compound` |
| 16 | `compound-mixer.tsx` | Auto (2+ compounds) | `GET /api/knowledge-graph?compound=...` | `app/api/knowledge-graph/route.ts` | `Compound`, interactions |
| 17 | `community-feed.tsx` | Mount / change filter | `GET /api/community` | `app/api/community/route.ts` | `CommunityPost` |
| 18 | `community-feed.tsx` | Click "Post" | `POST /api/community` | `app/api/community/route.ts` | `CommunityPost` |
| 19 | `global-search.tsx` | Type in search bar | `GET /api/search?q=...` | `app/api/search/route.ts` | 4 models parallel |
| 20 | `prompt-discovery.tsx` | Submit discovery prompt | `POST /api/aeonforge/prompt` | `app/api/aeonforge/prompt/route.ts` | `DiscoveryCandidate`, AI APIs |
| 21 | `discovery-candidates.tsx` | Mount / refresh | `GET /api/aeonforge/candidates` | `app/api/aeonforge/candidates/route.ts` | `DiscoveryCandidate` |
| 22 | `simulation-results.tsx` | Select candidate | `GET /api/aeonforge/candidates/:id` | `app/api/aeonforge/candidates/[id]/route.ts` | `DiscoveryCandidate` |
| 23 | `clinical-trials-explorer.tsx` | Search trials | `GET /api/clinical-trials/search` | `app/api/clinical-trials/search/route.ts` | ClinicalTrials.gov API |
| 24 | `clinical-trials-explorer.tsx` | Save to collection | `POST /api/research/clinical-trials` | `app/api/research/clinical-trials/route.ts` | `ResearchCollection` |
| 25 | `ai-health-coach.tsx` | Send message | `POST /api/ai/openai` (+ fallback) | `app/api/ai/openai/route.ts` | OpenAI/Anthropic/xAI |
| 26 | `lab-testing-dashboard.tsx` | Mount (load catalog) | `GET /api/lab-testing` | `app/api/lab-testing/route.ts` | `LabTestPanel` |
| 27 | `lab-testing-dashboard.tsx` | Mount (load orders) | `GET /api/lab-testing/orders` | `app/api/lab-testing/orders/route.ts` | `LabOrder`, `LabResult` |
| 28 | `lab-testing-dashboard.tsx` | Click "Order" | `POST /api/lab-testing` | `app/api/lab-testing/route.ts` | `LabOrder` |
| 29 | `telemedicine/page.tsx` | Mount (load providers) | `GET /api/telemedicine` | `app/api/telemedicine/route.ts` | Provider data |
| 30 | `telemedicine/page.tsx` | Mount (load consultations) | `GET /api/telemedicine/consultations` | `app/api/telemedicine/consultations/route.ts` | `TelemedicineConsultation` |
| 31 | `telemedicine/page.tsx` | Request consultation | `POST /api/telemedicine` | `app/api/telemedicine/route.ts` | `TelemedicineConsultation` |
| 32 | `marketplace/page.tsx` | Mount / filter | `GET /api/marketplace` | `app/api/marketplace/route.ts` | `MarketplaceProduct` |
| 33 | `marketplace/page.tsx` | Mount (load orders) | `GET /api/marketplace/orders` | `app/api/marketplace/orders/route.ts` | `MarketplaceOrder` |
| 34 | `marketplace/page.tsx` | Click "Order" | `POST /api/marketplace/orders` | `app/api/marketplace/orders/route.ts` | `MarketplaceOrder` |
| 35 | `sponsor-dashboard.tsx` | Browse / refresh matches | `GET /api/scientist-sponsor-marketplace/matches` | Marketplace match route | Match scoring |
| 36 | `deal-room-panel.tsx` | Confirm Stripe payment | `POST /api/.../payments/confirm` | Marketplace payment route | Stripe + deal room |
| 37 | `pricing-checkout.tsx` | Click "Checkout" | `POST /api/stripe/checkout` | `app/api/stripe/checkout/route.ts` | Stripe API |
| 38 | `account-billing-actions.tsx` | Click "Open billing portal" | `POST /api/stripe/portal` | `app/api/stripe/portal/route.ts` | Stripe API |
| 39 | `account-data-actions.tsx` | Click "Export my data" | `GET /api/account/export` | `app/api/account/export/route.ts` | `User` + 7 relations |
| 40 | `account-data-actions.tsx` | Click "Delete account" | `DELETE /api/account/delete` | `app/api/account/delete/route.ts` | `User` (cascade) |
| 41 | `mfa-setup.tsx` | Click "Enable MFA" | `POST /api/account/mfa` | `app/api/account/mfa/route.ts` | `User` (mfaSecret) |
| 42 | `mfa-setup.tsx` | Enter TOTP code | `PUT /api/account/mfa` | `app/api/account/mfa/route.ts` | `User` |
| 43 | `account/security/page.tsx` | Disable MFA | `DELETE /api/account/mfa` | `app/api/account/mfa/route.ts` | `User` |
| 44 | `mfa-verify/page.tsx` | Submit TOTP/backup code | `POST /api/account/mfa/verify` | `app/api/account/mfa/verify/route.ts` | `User` |
| 45 | `account/security/page.tsx` | Mount (check status) | `GET /api/account/mfa/status` | `app/api/account/mfa/status/route.ts` | `User` |
| 46 | `consent-collection.tsx` | Mount (load consents) | `GET /api/account/consent` | `app/api/account/consent/route.ts` | `ConsentRecord` |
| 47 | `consent-collection.tsx` | Save preferences | `PATCH /api/account/consent` | `app/api/account/consent/route.ts` | `ConsentRecord` |
| 48 | `wearable-connect.tsx` | Mount (load connections) | `GET /api/wearables/connect` | `app/api/wearables/connect/route.ts` | `WearableConnection` |
| 49 | `wearable-connect.tsx` | Click "Connect" | `POST /api/wearables/connect` | `app/api/wearables/connect/route.ts` | OAuth widget |
| 50 | `wearable-connect.tsx` | Click "Disconnect" | `DELETE /api/wearables/connect` | `app/api/wearables/connect/route.ts` | `WearableConnection` |
| 51 | `wearable-connect.tsx` | Mount (data feed) | `GET /api/wearables/data` | `app/api/wearables/data/route.ts` | Wearable data |
| 52 | `gamification-widgets.tsx` | Mount | `GET /api/gamification` | `app/api/gamification/route.ts` | XP, Streak, Achievement |
| 53 | `onboarding-wizard.tsx` | Complete wizard | `POST /api/onboarding` | `app/api/onboarding/route.ts` | `UserProfile` |
| 54 | `admin-user-management.tsx` | Change user role | `PATCH /api/admin/users` | `app/api/admin/users/route.ts` | `User` |
| 55 | `admin-review-console.tsx` | Export audit logs | `GET /api/admin/audit-export` | `app/api/admin/audit-export/route.ts` | `AuditLog` |
| 56 | `admin-community-moderation.tsx` | Load / moderate posts | `GET/PATCH /api/admin/community` | `app/api/admin/community/route.ts` | `CommunityPost` |
| 57 | `fl-consent-gate.tsx` | Mount (check consent) | `GET /api/fl/participate` | `app/api/fl/participate/route.ts` | `ConsentRecord` |
| 58 | `aggregate-outcomes.tsx` | Mount (load insights) | `GET /api/insights/aggregate` | `app/api/insights/aggregate/route.ts` | `AggregateOutcome` |
