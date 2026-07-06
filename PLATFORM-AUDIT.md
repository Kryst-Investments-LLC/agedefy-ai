# Platform Audit Report — Biozephyra / AgeDefy AI
**Date:** 2026-06-12  
**Auditor:** Claude Sonnet 4.6 (skeptical, evidence-based)  
**Ground rule:** Every claim verified against actual source code. Docs/README/readiness-report files are explicitly *not* treated as evidence.

---

## 1. Executive Summary

The platform is a legitimately substantial Next.js codebase with real business logic across auth, payments, biomarker tracking, research ingestion, and AI orchestration. It is **not** a facade — most routes have real implementations, the database schema is well-designed, and the test coverage is meaningful. However, **roughly 25–30% of claimed features are either stubs, unconfigured external dependencies, or scaffolding that has no functional backing in the current build.**

The biggest gaps between what is claimed and what is real:

1. **ÆonForge "pharmaceutical discovery" and "simulation" are LLM prompt wrappers, not validated science engines.** The local engine (`lib/aeonforge/engine.ts`, `simulation.ts`, `virtual-twin.ts`) calls GPT/Claude/Grok with a system prompt and returns whatever the model generates. There is no external ÆonForge API configured (`AEONFORGE_API_ENDPOINT` is blank). The output is explicitly labeled "hypothetical" in disclaimers but marketed as "pharmaceutical superintelligence."

2. **The jurisdiction/legal compliance layer is fully scaffolded but functionally inert.** `lib/legal/jurisdiction-gate.ts` and `rules-loader.ts` exist and look correct, but `@longevity-standards/legal-rules` **is not installed**, the gate is **never called from any production route**, and the YAML rule files in `agents/legal-rules/` are never loaded by any code path.

3. **16 tests fail, 2 entire test suites cannot run at all** (`mechanistic-models-api`, `scientist-sponsor-marketplace-integration`) because they require a live server at `http://127.0.0.1:3101` which does not exist in this environment. The digital-twin PDF route has a syntax error (missing semicolon at line 66 of `app/api/wallet/digital-twin/pdf/route.ts`) causing 6 test failures and a TypeScript compile error.

4. **Federated Learning is a client adapter pointing to `http://localhost:8081`** (a Flower Python server that does not exist anywhere in this repository). There is no FL server, no model training, and `FL_SERVER_URL` is not set. The FL dashboard UI will gracefully show "server not reachable."

5. **Lab OCR defaults to `noop` (throws 503)** unless `OPENAI_API_KEY` is set. With no keys configured in the default `.env`, this feature silently fails at runtime for new deployments.

Overall maturity estimate: ~70% of features are genuinely implemented and wired. ~15% are scaffolded/stub (real structure, no functional output). ~15% depend on external services that are not configured or do not exist in this repo.

---

## 2. Infrastructure Reality

### Database
- **Current:** SQLite via `DATABASE_URL="file:./prisma/dev.db"` — confirmed in `.env`
- **Schema:** 124 `model` declarations in `prisma/schema.prisma`, fully normalized, no TODOs
- **Production-ready?** No. SQLite is explicitly dev-only. PostgreSQL migration path exists (migration baseline in `prisma/migrations/`) but requires provisioning a managed Postgres instance and setting `DATABASE_URL` to a real connection string. **No production database is configured.**

### Authentication
- NextAuth with Prisma adapter — ✅ real implementation in `lib/auth.ts`
- Credentials + OIDC providers, TOTP MFA (`lib/mfa.ts`), RBAC (`lib/rbac.ts`) — all real code
- `NEXTAUTH_SECRET` is blank in `.env` — required for sessions to work at all
- `ENABLE_TEST_AUTH_ENDPOINT="false"` is correctly set

### Payments (Stripe)
- Stripe client, checkout, webhooks, portal — real code in `app/api/stripe/`
- **3 Stripe webhook tests currently failing** due to `db.idempotencyRecord` mock gap
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are blank — **Stripe is in dead-key mode**
- No Stripe products, prices, or webhooks are registered anywhere

### Secrets / Keys
All of the following are **blank strings** in the committed `.env`:
- `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROK_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SMTP_HOST/USER/PASS` (email is non-functional)
- `TERRA_API_KEY`, `DEXCOM_CLIENT_ID/SECRET` (wearables non-functional)
- `AEONFORGE_API_ENDPOINT`, `AEONFORGE_API_KEY`

**With no keys set, the following features silently fail or throw at runtime:** AI health coach, bio-age computation, AeonForge discovery, Stripe checkout, email (password reset/verification), wearable sync, lab OCR.

### Hosting / Deploy
- Dockerfile exists (not inspected in detail), Helm charts in `charts/`, K8s overlays in `k8s/`
- No deployment has been made — no environment URLs, no `NEXTAUTH_URL` other than `http://localhost:3000`

---

## 3. Feature Inventory Table

| Feature | What it does | Status | Key files | Tests exist? | Tests pass? | Stubs/mocks/issues |
|---------|-------------|--------|-----------|-------------|-------------|-------------------|
| Auth (credentials) | Email/password login | ✅ | `lib/auth.ts` | ✅ | ✅ | Blank `NEXTAUTH_SECRET` in `.env` |
| Auth (OIDC/SSO) | Enterprise SSO | 🟡 | `lib/auth.ts` | ✅ | ✅ | Requires `SSO_*` vars not set |
| MFA (TOTP) | Two-factor auth | ✅ | `lib/mfa.ts`, `lib/mfa-crypto.ts` | ✅ | ✅ | — |
| RBAC | Role-based access control | ✅ | `lib/rbac.ts` | ✅ | ✅ | — |
| GDPR consent | Per-category consent gating | ✅ | `lib/consent.ts` | ✅ | ✅ | Real DB checks on every AI route |
| Bio-age computation | AI-computed biological age | 🟡 | `lib/bio-age/compute-bio-age.ts` | ✅ | ✅ | Requires an AI provider key; falls back to error |
| Biomarker tracking | CRUD + trends | ✅ | `app/api/biomarkers/`, `components/biomarker-trends.tsx` | ✅ | ✅ | — |
| Compound mixer | Pathway/interaction explorer | ✅ | `components/compound-mixer.tsx`, `app/api/compounds/` | ✅ | ✅ | Queries real DB; seeds needed for useful data |
| Pathways | Longevity pathway browser | ✅ | `app/pathways/`, `app/api/pathways/` | 🟡 | 🟡 | DB seed needed |
| Research ingestion | PubMed article ingest | ✅ | `lib/research.ts`, `app/api/research/` | ✅ | ✅ | Feature flags now ON; free NCBI API |
| Clinical Trials | ClinicalTrials.gov search | ✅ | `components/clinical-trials-explorer.tsx` | ✅ | ✅ | Feature flag now ON; free API |
| Intelligence workspace | Biomedical evidence + cohort analysis | ✅ | `app/intelligence/page.tsx`, `components/biomedical-intelligence-workspace.tsx` | ✅ | ✅ | — |
| AI Health Coach | GPT/Claude health Q&A | 🟡 | `components/ai-health-coach.tsx`, `app/api/ai/anthropic/` | ✅ | ✅ | Requires AI key; no medical review |
| AeonForge discovery | "Pharmaceutical discovery" | 🎭 | `lib/aeonforge/engine.ts` | ✅ | 🟡 (2 fail) | **LLM prompt wrapper — see §5** |
| AeonForge simulation | "Virtual cell/organ simulation" | 🎭 | `lib/aeonforge/simulation.ts` | ✅ | ✅ | **LLM prompt wrapper** |
| Virtual twin (AeonForge) | "Hallmark aging predictions" | 🎭 | `lib/aeonforge/virtual-twin.ts` | ✅ | ✅ | **LLM prompt wrapper** |
| Digital twin agent | Trajectory forecasting | 🟡 | `lib/agents/digital-twin-agent.ts` | ✅ | ❌ (1 fail) | Falls back to exponential formula; sidecar not configured |
| Digital twin PDF | VC receipt PDF export | ❌ | `app/api/wallet/digital-twin/pdf/route.ts` | ✅ | ❌ (6 fail) | **Syntax error on line 66**; TS compile error |
| Causal inference | DoWhy/EconML agent | 🟡 | `app/api/agents/causal-inference/`, `lib/sidecars.ts` | ✅ | ✅ | Requires `CAUSAL_SIDECAR_URL` (defaults to fly.dev stub URL) |
| VC signing | W3C Verifiable Credentials | 🟡 | `lib/recommendations/sign.ts`, `lib/sidecars.ts` | ✅ | 🟡 (1 fail) | Requires `VC_SIGNER_URL` sidecar |
| Jurisdiction gate | Legal compliance routing | 🩹 | `lib/legal/jurisdiction-gate.ts`, `lib/legal/rules-loader.ts` | ✅ | ✅ | **`@longevity-standards/legal-rules` NOT installed; gate NEVER CALLED from production routes** |
| Stripe checkout | Subscription + credit purchases | ✅ | `app/api/stripe/checkout/` | ✅ | ❌ (3 fail) | Mock gap in `db.idempotencyRecord`; keys blank |
| Stripe webhooks | Subscription lifecycle | ✅ | `app/api/stripe/webhook/` | ✅ | ❌ (3 fail) | Same mock gap |
| Marketplace | Product catalog + orders | ✅ | `app/marketplace/`, `app/api/marketplace/` | ✅ | ❌ (suite fails) | Integration tests need live server at port 3101 |
| Scientist-sponsor | Researcher/sponsor matchmaking | ✅ | `scientist-sponsor-marketplace/` | ✅ | ❌ (suite fails) | Integration tests need live server |
| Telemedicine | Provider directory + consult requests | ✅ | `app/telemedicine/page.tsx`, `app/api/telemedicine/` | 🟡 | 🟡 | No video/scheduling integration; UI-only form |
| Community feed | Posts + moderation | ✅ | `components/community-feed.tsx`, `app/api/community/` | ✅ | ✅ | — |
| Lab OCR | PDF lab report transcription | 🟡 | `lib/agents/lab-report-ocr.ts` | ✅ | ✅ | Defaults to `noop` (503) without `OPENAI_API_KEY` |
| Wearable sync | Terra/Dexcom integrations | 🟡 | `app/api/wearables/` | ✅ | ✅ | Keys blank; Dexcom defaults to sandbox host |
| Federated learning | Privacy-preserving model training | 🩹 | `lib/fl/client.ts`, `app/api/fl/` | ✅ | ✅ | **No FL server exists; defaults to `localhost:8081`** |
| Outcome flywheel | k-anon + DP aggregate stats | ✅ | `lib/flywheel/outcome-aggregator.ts` | ✅ | ✅ | — |
| Admin panel | Job control, audit logs, users | ✅ | `app/admin/`, `components/admin/` | ✅ | ✅ | — |
| AI credits system | Usage metering + limits | ✅ | `lib/ai-credits.ts` | ✅ | ✅ | — |
| Rate limiting | Per-route request limits | ✅ | `lib/rate-limit.ts` | ✅ | ✅ | — |
| Circuit breaker | External dependency resilience | ✅ | `lib/circuit-breaker.ts` | ✅ | ✅ | — |
| Idempotency | Duplicate request prevention | ✅ | `lib/idempotency.ts` | ✅ | ✅ | — |
| Multi-tenancy | Tenant isolation | 🟡 | `lib/tenancy.ts` | ✅ | ❌ (2 fail) | Header-based tenant validation broken in tests |
| Observability (OTEL) | Distributed tracing + metrics | 🟡 | `lib/observability/`, `instrumentation.ts` | ✅ | ✅ | No OTLP endpoint configured |
| Email (auth flows) | Password reset, verification | 🟡 | `lib/services/email-service.ts` | ✅ | ✅ | SMTP credentials blank — emails silently fail |
| Knowledge graph | Compound pathway relationships | 🟡 | `lib/knowledge-graph/`, `lib/knowledge-graph/relational-backend.ts` | ✅ | ✅ | Neo4j backend is **explicit stub** (throws); relational backend works |

---

## 4. External Integrations

| Integration | Status | Feature flags | Evidence |
|-------------|--------|--------------|---------|
| **OpenAI** | Configured-but-off (key blank) | `NEXT_PUBLIC_ENABLE_CHATGPT="true"` but `OPENAI_API_KEY=""` | Real HTTP calls in `lib/aeonforge/engine.ts`, `lib/bio-age/`, `lib/agents/lab-report-ocr.ts` |
| **Anthropic** | Configured-but-off (key blank) | `NEXT_PUBLIC_ENABLE_ANTHROPIC="true"` but `ANTHROPIC_API_KEY=""` | Real HTTP calls in same files |
| **Grok (xAI)** | Off + key blank | `NEXT_PUBLIC_ENABLE_GROK="false"` | Real HTTP calls in same files; flag OFF |
| **ÆonForge external API** | Stub (endpoint blank) | N/A | `AEONFORGE_API_ENDPOINT=""` → falls back to local LLM engine |
| **PubMed (NCBI eUtils)** | ✅ Wired (no key required) | `NEXT_PUBLIC_ENABLE_PUBMED_API="true"` | Real fetch in `lib/research.ts`; NCBI is a free API |
| **ClinicalTrials.gov** | ✅ Wired (no key required) | `NEXT_PUBLIC_ENABLE_CLINICAL_TRIALS_API="true"` | Free API; flag ON |
| **Biomarker API** | Flag ON, implementation unclear | `NEXT_PUBLIC_ENABLE_BIOMARKER_API="true"` | Flag set; no dedicated external API client found — likely refers to internal DB |
| **Stripe** | Real code, keys blank | N/A | `STRIPE_SECRET_KEY=""` — all payment flows will error |
| **Email (SMTP)** | Real code, credentials blank | N/A | `SMTP_HOST=""` — password reset/verification emails will fail silently |
| **Terra (wearables)** | Real code, key blank | N/A | `TERRA_API_KEY=""` |
| **Dexcom (CGM)** | Real code, sandbox mode | `DEXCOM_API_HOST="https://sandbox-api.dexcom.com"` | Keys blank; sandbox host set |
| **Causal sidecar** | Wired to Fly.io URL (may not exist) | N/A | `CAUSAL_SIDECAR_URL="https://agedefy-causal-sidecar.fly.dev"` — this is an external service the author must deploy separately |
| **VC signer sidecar** | Wired to Fly.io URL (may not exist) | N/A | `VC_SIGNER_URL="https://agedefy-vc-signer.fly.dev"` |
| **Mechanistic sidecar** | Not configured (in-process fallback used) | N/A | `MECHANISTIC_SIDECAR_URL=""` — fallback exponential simulator active |
| **Federated learning server** | Not configured | N/A | `FL_SERVER_URL` not set → `http://localhost:8081` default; no server exists in repo |
| **`@longevity-standards/legal-rules`** | **NOT INSTALLED** | N/A | `node_modules/@longevity-standards` does not exist; rules loader falls back to empty rule set |
| **Neo4j** | Explicit stub (throws) | `KG_BACKEND=neo4j` | `lib/knowledge-graph/neo4j-backend.ts` — all methods call `notConfigured()` |

---

## 5. AI & "Discovery" Layer — Blunt Assessment

### What the AI routes actually do

**`POST /api/aeonforge/prompt` and `POST /api/v1/aeonforge/discover`:**  
These routes call `aeonforgeService.discoverCandidates()`. Since `AEONFORGE_API_ENDPOINT` is blank, they call `discoverCandidatesLocal()` in `lib/aeonforge/engine.ts`. That function:
1. Parses the prompt for pathway keywords (regex matching)
2. Queries the Prisma DB for compounds in matching pathways
3. Sends an enriched prompt to OpenAI/Anthropic/Grok asking it to "generate 3–5 molecular candidates"
4. Parses the LLM's JSON output

**This is a language model generating plausible-sounding molecules.** The SMILES strings, mechanisms, and "estimated healthspan gain in days" are invented by the LLM. They are not validated against any chemistry database, not run through any actual simulation, and not cross-referenced against published clinical evidence. The code correctly disclaims this: *"All candidates are AI-generated hypotheses for informational purposes only."*

**`POST /api/v1/aeonforge/simulate`:**  
Calls `runSimulations()` in `lib/aeonforge/simulation.ts`. This sends the candidate molecule name + mechanism to the LLM with a system prompt like "You are a computational biologist simulating molecular interactions." The confidence score is derived from the LLM's `estimatedEffect` field — i.e., the LLM assigns its own confidence. There is no physics engine, no PK/PD model, no molecular dynamics. **It is the LLM roleplaying as a simulator.**

**`POST /api/v1/aeonforge/virtual-twin`:**  
Calls `generateVirtualTwinLocal()` in `lib/aeonforge/virtual-twin.ts`. Same pattern: sends user age + biomarkers + candidate molecule to the LLM asking for 9 hallmark-of-aging scores. The LLM returns numbers. **This is not a physiological model of any kind.**

### Model versions (as of audit)
| Provider | Configured model | Current? |
|----------|-----------------|---------|
| Anthropic | `claude-sonnet-4-6` | ✅ Yes |
| OpenAI | `gpt-4o-mini` | ✅ Yes (cost-effective tier) |
| Grok | `grok-3` | ✅ Yes |
| AeonForge | `biozephyra-local-v1` (self-assigned) | N/A — not a real service |

### Bio-age computation
`lib/bio-age/compute-bio-age.ts` uses the same LLM-prompt pattern: it sends biomarker values to GPT/Claude and asks it to compute biological age "using Klemera-Doubal, PhenoAge, GrimAge as conceptual reference." The LLM is not running those algorithms; it is pattern-matching against training data. The output is a plausible number, not a validated clinical score.

### Honest verdict
The AI layer is a well-structured **LLM orchestration platform**. It handles auth, rate-limiting, credits, idempotency, audit logging, and circuit breaking correctly. What it does NOT have is any validated biomedical model, any connection to a real drug database, or any computational chemistry. The naming ("pharmaceutical superintelligence," "digital twin," "simulation") significantly overstates what the code does.

---

## 6. Security & Compliance Posture

### Real (enforced in code)
- **Rate limiting** — `applyRateLimit()` called on every AI and sensitive route ✅
- **GDPR consent gate** — `requireGdprConsent()` called before AI routes return health data ✅ (enforced against DB)
- **RBAC** — `lib/rbac.ts` enforced on admin routes ✅
- **Session auth** — `getServerSession()` checked on all protected routes ✅
- **AI governance model allowlist** — `assertGovernedAIRequest()` enforced when `AI_GOVERNANCE_ENFORCED=true` ✅
- **Idempotency** — `executeIdempotentJsonMutation()` on mutation routes ✅
- **Circuit breaker** — wraps all external sidecar calls ✅
- **Audit log** — `logAudit()` called on all sensitive operations ✅
- **Multi-tenant isolation** — tenant context derived and checked on routes ✅ (though 2 tests currently failing)
- **CSP headers** — set in `middleware.ts` ✅

### Scaffolding (looks like compliance, does nothing)
- **`agents/legal-rules/*.yml`** — YAML files describing HIPAA, FDA, GDPR rules. `@longevity-standards/legal-rules` package **not installed**. `loadJurisdictionRuleSet()` returns an empty rule set. `gateAndRecord()` is **never called from any production route**. These files provide zero runtime compliance.
- **Federated learning privacy budget** — `lib/fl/gradient-privacy.ts` has DP noise logic, but the FL server does not exist. The privacy guarantees are theoretical.
- **`SECURITY.md`** — documentation only
- **`docs/SOC2-CONTROLS-MAPPING.md`** — documentation only; no third-party audit
- **`docs/COMPLIANCE-AND-MEDICAL-CLAIM-REVIEW.md`** — documentation only
- **W3C Verifiable Credentials** — the VC signing infra (`lib/recommendations/sign.ts`) is real code wired to a sidecar, but the sidecar at `https://agedefy-vc-signer.fly.dev` must be independently deployed and functioning. No evidence it exists.

### Medical advice risk (unmitigated)
The AI health coach, bio-age route, and AeonForge discovery give users health-related information (biomarker interpretation, compound recommendations, biological age scores) with no clinical review workflow. The disclaimers in code say "not medical advice" but there is no hard block preventing the system from giving specific dosing suggestions or disease-related claims. No medical reviewer is wired into the product path.

---

## 7. Test & Quality Status

### TypeScript typecheck
```
Result: 3 errors (all in one file)
File:   app/api/wallet/digital-twin/pdf/route.ts:66
Errors: TS1005 ',' expected (×3) — missing semicolon between statements
```
The rest of the codebase typechecks cleanly.

### ESLint
```
Result: CRASHED — circular structure error
ESLint 8.57.1 fails with: TypeError: Converting circular structure to JSON
Root cause: react plugin circular reference in .eslintrc.json config resolution
Lint status: UNKNOWN — cannot produce a clean pass/fail count
```

### Test suite (vitest)
```
Test Files:  10 failed | 103 passed (113 total)
Tests:       16 failed | 781 passed | 28 skipped (825 total)
Duration:    ~65 seconds
```

**Failed test files and root causes:**

| Test file | Root cause | Fixable without code change? |
|-----------|-----------|------------------------------|
| `mechanistic-models-api.test.ts` | Requires live server at `http://127.0.0.1:3101` — not running | No (need `TEST_SERVER_BASE_URL` + running dev server) |
| `scientist-sponsor-marketplace-integration.test.ts` | Same — needs live server | No |
| `digital-twin-pdf-route.test.ts` (6 tests) | Syntax error in `app/api/wallet/digital-twin/pdf/route.ts:66` (missing semicolon) | Yes — one-character fix |
| `digital-twin-agent.test.ts` (1 test) | `expected 0.989 to be greater than 0.99` — floating point precision in fallback simulator | No — logic/tolerance issue |
| `aeonforge-smart-router.test.ts` (2 tests) | `db.user.findUnique` undefined — incomplete mock setup | No — test mock issue |
| `credentials-verify-route.test.ts` (1 test) | Assertion mismatch in `display_policy` derivation | No — logic issue |
| `jwt-for-tests-integration.test.ts` (1 test) | Route returns 500 (likely DB/config not set up) | No — needs running server |
| `stripe-webhook-ai-credits.test.ts` (2 tests) | `db.idempotencyRecord.create` not in mock | No — test mock gap |
| `stripe-webhook-marketplace.test.ts` (1 test) | Same `db.idempotencyRecord` mock gap | No — test mock gap |
| `tenant-header-validation.test.ts` (2 tests) | `deriveTenantContextWithValidation` returns null; `DEFAULT_TENANT_ID` env not set in test | No — test config |

**28 skipped tests** — not inspected individually but `it.skip` / `describe.skip` patterns exist throughout.

---

## 8. Built vs Planned

### Actually built and working (with keys configured)
- Full auth stack: credentials, OIDC, MFA, RBAC, sessions, audit
- Stripe payments: checkout, subscriptions, webhooks, portal, AI credit packs
- Biomarker CRUD, trends, bio-age AI computation (LLM-based)
- Compound mixer with real DB queries
- PubMed ingestion + research collections
- ClinicalTrials.gov search integration
- Biomedical intelligence workspace (evidence scoring, cohort calibration)
- AI health coach (OpenAI/Anthropic/Grok with governance, rate limiting, credits)
- AeonForge LLM discovery/simulation (disclaimer-wrapped LLM outputs)
- Digital twin trajectory forecasting (deterministic fallback OR mechanistic sidecar)
- Causal inference agent (delegates to Python sidecar at Fly.io)
- Telemedicine consultation request workflow
- Community feed with moderation
- Marketplace product catalog + orders
- Scientist-sponsor matchmaking workspace
- Federated learning client API (server must be deployed separately)
- Outcome flywheel with k-anonymity + differential privacy aggregation
- Full admin panel: jobs, users, audit logs, governance dashboard
- Multi-tenant isolation
- GDPR consent gating (enforced, not scaffolded)
- Observability: OTEL, custom metrics, Grafana dashboard JSONs (need OTLP endpoint)
- Rate limiting, circuit breaker, idempotency — all production-grade

### Documented/aspirational — not in this codebase
- A real pharmaceutical discovery engine (molecular screening, validated chemistry)
- A real digital twin (physiologically calibrated PK/PD model)
- HIPAA BAA process, SOC2 audit, FDA regulatory pathway
- Wet-lab validation
- Federated learning server (the Python/Flower component)
- Neo4j graph backend (explicit `notConfigured()` stub)
- `@longevity-standards/legal-rules` package (not installed anywhere)
- VC signer sidecar (must be deployed to Fly.io separately)
- Video/scheduling for telemedicine (request form only, no video stack)
- Real-time data feeds (`NEXT_PUBLIC_ENABLE_REAL_TIME_DATA="false"`)

---

## 9. Honest Production-Readiness Verdict

| Area | Verdict | Rationale |
|------|---------|-----------|
| **Core auth & sessions** | 🟡 Ready pending secrets | Real code; `NEXTAUTH_SECRET` must be set |
| **Database** | ❌ Not ready | SQLite in `.env`; no Postgres provisioned |
| **Payments** | 🟡 Ready pending Stripe setup | Real code; keys and products not configured |
| **AI features (health coach, bio-age)** | 🟡 Ready pending API keys | Real orchestration; requires provider keys |
| **AeonForge "discovery"** | ⚠️ Functional but misleadingly named | Works as LLM wrapper; not a science engine |
| **Research data (PubMed/trials)** | ✅ Ready | Free APIs, real implementation, flags now ON |
| **Digital twin PDF** | ❌ Not ready | Syntax error breaks the route and 6 tests |
| **Jurisdiction/legal compliance** | ❌ Not ready | Package not installed; gate never invoked |
| **Federated learning** | ❌ Not ready | No FL server in repo or deployed |
| **Sidecars (causal, VC, mechanistic)** | 🟡 Partial | Must be independently deployed to Fly.io |
| **Wearables** | 🟡 Ready pending keys | Real code; Terra/Dexcom keys blank |
| **Email** | ❌ Not ready | SMTP credentials blank |
| **Observability** | 🟡 Ready pending OTLP endpoint | SDK wired; no exporter target set |
| **Test suite** | 🟡 Mostly passing | 781/825 pass; 16 real failures; lint broken |
| **TypeScript** | 🟡 Nearly clean | 3 errors in one file (fixable in minutes) |
| **Overall for launch** | ❌ Not yet | Blocked on Postgres, secrets, TS fix, and the ESLint config issue |

### The shortest path to a launchable state

1. Fix the syntax error in `app/api/wallet/digital-twin/pdf/route.ts:66` (add semicolon) — 5 minutes
2. Provision Postgres, update `DATABASE_URL`, run `prisma migrate deploy`
3. Set `NEXTAUTH_SECRET`, `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)
4. Set `SMTP_*` credentials for email
5. Set `STRIPE_SECRET_KEY`, create Stripe products, register webhook
6. Fix the ESLint circular-reference config issue
7. Fix the `db.idempotencyRecord` mock in Stripe webhook tests

Everything else (sidecars, FL, Neo4j, jurisdiction compliance) can be deferred — the platform degrades gracefully without them.
