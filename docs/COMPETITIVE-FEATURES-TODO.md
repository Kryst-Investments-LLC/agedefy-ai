# Competitive Features — Full Implementation TODO

> Generated: 2026-04-09
> Status: Each item tagged with current coverage, priority, effort, and dependencies.
> Wording follows verified-versus-planned conventions — items marked **implemented** have code evidence; all others are **planned**.

---

## A. Competitive Gaps to Close

### 1. PWA / Mobile App

**Current coverage: ~5%** — responsive viewport meta and `useIsMobile()` hook only.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| A1.1 | Create `public/manifest.webmanifest` with name, short_name, start_url, display: standalone, theme_color, background_color, icons (192 + 512 PNG + maskable) | 1 h | Icon assets | planned |
| A1.2 | Add `<link rel="manifest">` and Apple-touch-icon meta in `app/layout.tsx` | 15 min | A1.1 | planned |
| A1.3 | Install and configure `@serwist/next` (Workbox successor for Next.js 15) in `next.config.mjs` — precache App Shell, runtime-cache API routes with stale-while-revalidate | 2–3 h | `@serwist/next` | planned |
| A1.4 | Create `app/offline/page.tsx` fallback page (branded, links to cached pages) | 30 min | A1.3 | planned |
| A1.5 | Add `beforeinstallprompt` handler and install banner component (`components/pwa-install-banner.tsx`) | 1 h | A1.3 | planned |
| A1.6 | Integrate Web Push notifications — `web-push` server-side, `PushSubscription` Prisma model, `app/api/push/subscribe/route.ts` and `app/api/push/send/route.ts` | 4–6 h | `web-push`, VAPID keys | planned |
| A1.7 | Add Lighthouse PWA audit to CI (score ≥ 90) | 1 h | A1.3 | planned |
| A1.8 | (Optional) Capacitor native shell for App Store / Play Store distribution | 2–3 d | Capacitor, Xcode/Android Studio | planned |

**Total estimated effort: 1–2 days (PWA core) + 2–3 days (native shell)**

---

### 2. Wearable Integrations

**Current coverage: ~30%** — `WearableEvent` types, Zod schemas, `health.wearable.v1` topic, `WEARABLE` partner data source, ops panel section — but zero device connectors.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| A2.1 | Create Terra API developer account, obtain API key and webhook secret | 30 min | Terra account ($) | planned |
| A2.2 | Install `terra-api` SDK; create `lib/wearables/terra-client.ts` — initialise client, generate widget session, handle token exchange | 2–3 h | `terra-api` | planned |
| A2.3 | Create `app/api/wearables/connect/route.ts` — authenticated endpoint that returns Terra widget session URL for the user | 1 h | A2.2 | planned |
| A2.4 | Create `app/api/wearables/webhook/route.ts` — Terra webhook receiver: validate `terra-signing-key` header, parse payload, normalise to `WearableEvent`, publish to `health.wearable.v1` topic | 3–4 h | A2.2 | planned |
| A2.5 | Create `lib/wearables/normalizer.ts` — map Terra body/activity/sleep/nutrition payloads to canonical `WearableEventPayload` types | 3–4 h | A2.4 | planned |
| A2.6 | Add `WearableConnection` Prisma model (`userId`, `provider`, `terraUserId`, `scopes`, `connectedAt`, `lastSyncAt`) | 30 min | — | planned |
| A2.7 | Create `components/wearable-connect.tsx` — UI card listing supported devices (Apple Watch, Garmin, Oura, Whoop, Fitbit), connect/disconnect buttons, sync status | 2–3 h | A2.3 | planned |
| A2.8 | Create `app/dashboard/wearables/page.tsx` — daily wearable data visualisation (HRV, sleep, steps, recovery) with charts | 4–6 h | A2.5, chart lib | planned |
| A2.9 | Wire wearable data into `generateRecommendations()` in `lib/analytics/recommendations.ts` so recs adapt to real-time biometrics | 2–3 h | A2.5 | planned |
| A2.10 | Add tests: webhook validation, normaliser unit tests, integration test with mock Terra payloads | 3–4 h | A2.4, A2.5 | planned |
| A2.11 | (Optional) Native HealthKit/Health Connect via Capacitor plugin for direct on-device reads (requires native shell A1.8) | 3–5 d | Capacitor, A1.8 | planned |

**Total estimated effort: 1–2 weeks**

---

### 3. Biological Age Score

**Current coverage: ~40%** — `virtual-twin.ts` computes `biologicalAge` from 9 hallmark aging scores via AI, but only in drug-discovery context. No standalone user-facing score or historical tracking.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| A3.1 | Create `lib/bio-age/compute-bio-age.ts` — `computeBiologicalAge(userId): Promise<BioAgeResult>` pulling user's biomarkers, health events, and optional wearable data, then calling AI provider with structured prompt returning a composite score + per-hallmark breakdown | 3–4 h | Existing virtual-twin code | planned |
| A3.2 | Add `BiologicalAgeSnapshot` Prisma model (`userId`, `chronologicalAge`, `biologicalAge`, `hallmarkScores Json`, `inputSummary`, `confidence`, `createdAt`) | 30 min | — | planned |
| A3.3 | Create `app/api/bio-age/route.ts` — POST triggers computation + persists snapshot, GET returns timeline of snapshots | 2 h | A3.1, A3.2 | planned |
| A3.4 | Create `components/bio-age-score-card.tsx` — hero card showing biological age, delta from chronological, trend arrow, hallmark radar chart | 3–4 h | A3.3, chart lib | planned |
| A3.5 | Create `components/bio-age-timeline.tsx` — line chart of bio-age over time with annotations (protocol changes, major events) | 2–3 h | A3.3 | planned |
| A3.6 | Add peer comparison — aggregate anonymised bio-age data by age cohort + sex, show percentile rank ("You're biologically younger than 72% of your age group") | 3–4 h | A3.3, anonymisation (see B8) | planned |
| A3.7 | Wire bio-age recalculation trigger when new biomarkers are ingested (event handler on `health.biomarker.v1` topic) | 1–2 h | A3.1, event system | planned |
| A3.8 | Add bio-age to dashboard home page as primary metric | 1 h | A3.4 | planned |
| A3.9 | Tests: computation with mock biomarkers, snapshot persistence, API routes, edge cases (insufficient data → graceful fallback) | 3–4 h | A3.1–A3.3 | planned |

**Total estimated effort: 2–3 days**

---

### 4. Onboarding / Personalization

**Current coverage: ~20%** — GDPR consent flow (`onboarding` mode), `longevityGoal` + `riskTolerance` profile fields, personalization page stub.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| A4.1 | Create `components/onboarding/onboarding-wizard.tsx` — multi-step stepper component (5–7 steps) with progress indicator, back/skip/next, step validation | 4–6 h | — | planned |
| A4.2 | Step 1: Welcome + account basics (already handled by register; this step confirms name + age + sex for bio-age computation) | 1 h | A4.1 | planned |
| A4.3 | Step 2: Health goals questionnaire — longevity priorities (cognitive, cardiovascular, metabolic, athletic, aesthetic), primary motivation, target bio-age delta | 2–3 h | A4.1 | planned |
| A4.4 | Step 3: Current health snapshot — existing conditions (multi-select), medication list (free-text with autocomplete from compound DB), supplement stack | 2–3 h | A4.1, compound data | planned |
| A4.5 | Step 4: Lifestyle assessment — activity level, sleep quality (1-5), dietary pattern (omnivore/vegan/keto/mediterranean/other), stress level, alcohol/smoking | 2 h | A4.1 | planned |
| A4.6 | Step 5: Data connections — upload recent bloodwork (PDF/image → OCR extraction), connect wearable (link to A2), connect EHR via FHIR (future) | 3–4 h | A2.3 (optional) | planned |
| A4.7 | Step 6: GDPR consent + notification preferences (wraps existing `ConsentCollection` component) | 1 h | Existing consent flow | planned |
| A4.8 | Step 7: Personalized dashboard preview — show recommended widgets based on answers, let user customise layout | 2–3 h | A4.3–A4.5 | planned |
| A4.9 | Expand `UserProfile` Prisma model with onboarding fields: `dietaryPattern`, `activityLevel`, `sleepQuality`, `stressLevel`, `healthConditions Json`, `supplementStack Json`, `onboardingCompletedAt` | 1 h | — | planned |
| A4.10 | Create `lib/personalization/seed-recommendations.ts` — use onboarding answers + bio-age (if available) to generate initial protocol + compound suggestions | 3–4 h | A4.9, recommendations engine | planned |
| A4.11 | Add onboarding gate: if `onboardingCompletedAt` is null, redirect to `/onboarding` from dashboard pages | 30 min | A4.9 | planned |
| A4.12 | Tests: wizard navigation, validation per step, recommendation seeding, redirect guard | 3–4 h | A4.1–A4.10 | planned |

**Total estimated effort: 3–5 days**

---

### 5. Gamification / Streaks

**Current coverage: ~10%** — outcome scoring engine (5-dimension weighted score) exists but no user-facing gamification.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| A5.1 | Design gamification schema — Prisma models: `UserStreak` (userId, type, currentCount, longestCount, lastActionAt), `Achievement` (code, title, description, icon, category, threshold), `UserAchievement` (userId, achievementId, unlockedAt), `UserXP` (userId, totalXP, level, updatedAt) | 1–2 h | — | planned |
| A5.2 | Create `lib/gamification/xp-engine.ts` — `awardXP(userId, action, amount)`, level-up thresholds, XP event constants (log_biomarker: 10, complete_protocol_day: 20, bio_age_check: 50, community_post: 5, wearable_sync: 5) | 2–3 h | A5.1 | planned |
| A5.3 | Create `lib/gamification/streak-tracker.ts` — `recordDailyAction(userId, type)`, streak increment/reset logic, streak recovery (1 grace day), streak milestones (7d, 30d, 100d, 365d) | 2–3 h | A5.1 | planned |
| A5.4 | Create `lib/gamification/achievement-evaluator.ts` — check unlock conditions after each action (first blood test uploaded, first protocol completed, 30-day streak, bio-age improved 1yr, 5 community posts, etc.), persist unlock, emit notification | 3–4 h | A5.1, A5.2, A5.3 | planned |
| A5.5 | Seed 20–30 achievement definitions in `prisma/seed.ts` across categories: Consistency, Knowledge, Community, Science, Health Milestones | 1–2 h | A5.1 | planned |
| A5.6 | Create `app/api/gamification/route.ts` — GET returns user's XP, level, streaks, recent achievements; POST records daily action | 2 h | A5.2–A5.4 | planned |
| A5.7 | Create `components/gamification/streak-display.tsx` — streak flame icon with count, animation on milestone, recovery warning | 1–2 h | A5.6 | planned |
| A5.8 | Create `components/gamification/xp-level-bar.tsx` — progress bar showing current XP, level, XP to next level | 1 h | A5.6 | planned |
| A5.9 | Create `components/gamification/achievements-grid.tsx` — grid of locked/unlocked badges with descriptions and unlock dates | 2–3 h | A5.6 | planned |
| A5.10 | Create `components/gamification/daily-actions.tsx` — checklist of suggested daily actions (log supplement, check biomarkers, read article, sync wearable) with completion state | 2–3 h | A5.6 | planned |
| A5.11 | Create `app/achievements/page.tsx` — full achievements page with categories, progress stats, leaderboard (opt-in) | 2–3 h | A5.9 | planned |
| A5.12 | Wire XP awards into existing event handlers: biomarker ingestion, protocol completion, community post creation, wearable sync, feedback loop submission | 2–3 h | A5.2, event system | planned |
| A5.13 | Add gamification widgets to dashboard home page (streak + XP bar + next achievement) | 1–2 h | A5.7, A5.8 | planned |
| A5.14 | Tests: XP calculation, streak logic (increment, reset, grace day), achievement evaluation, API routes | 3–4 h | A5.2–A5.6 | planned |

**Total estimated effort: 4–6 days**

---

### 6. Social Sharing

**Current coverage: ~95%** — OG image generation (4 templates), share button with Web Share API + fallback, shareable bio-age snapshot pages with HMAC-signed tokens, referral system with code generation + claim + XP reward hook, share-achievement-card component, per-page OG metadata.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| A6.1 | Create `app/api/og/route.tsx` — dynamic Open Graph image generation using `@vercel/og` (ImageResponse). Templates: bio-age score card, achievement unlock, protocol milestone, compound insight | 3–4 h | `@vercel/og` | **done** |
| A6.2 | Add per-page OG metadata in `generateMetadata()` for shareable pages: `/bio-age`, `/achievements`, `/protocols/[id]`, `/pathways/[id]` | 2 h | A6.1 | **done** |
| A6.3 | Create `components/share-button.tsx` — Web Share API (mobile) with fallback to copy-link + social buttons (Twitter/X, LinkedIn, Facebook). Uses `navigator.share()` with OG URL | 2 h | A6.2 | **done** |
| A6.4 | Create shareable snapshot pages: `app/share/bio-age/[token]/page.tsx` — public page showing anonymised bio-age card (no PII), accessed via time-limited signed token | 3–4 h | A3.4, token signing | **done** |
| A6.5 | Create `lib/sharing/share-token.ts` — generate/verify HMAC-signed share tokens with 7-day expiry, embed userId + shareType + timestamp | 1–2 h | — | **done** |
| A6.6 | Create referral system — `Referral` Prisma model (referrerId, refereeId, code, status, rewardGranted), `app/api/referrals/route.ts`, referral code generation on account page | 3–4 h | — | **done** |
| A6.7 | Add referral reward hook — when referee completes onboarding, award referrer 1 month premium or XP bonus | 1–2 h | A6.6, A5.2 | **done** |
| A6.8 | Create `components/share-achievement-card.tsx` — visually rich card for sharing achievement unlocks to social media | 2 h | A5.9, A6.3 | **done** |
| A6.9 | Tests: OG image generation, share token signing/verification/expiry, referral flow, Web Share API fallback | 2–3 h | A6.1–A6.6 | **done** |

**Total estimated effort: 2–3 days**

---

## B. Hard-to-Replicate Moats

### 7. Knowledge Graph at Scale

**Current coverage: ~70%** — full relational KG with 10 pathways, 12+ compounds, Prisma models (`Compound`, `Pathway`, `CompoundPathway`, `CompoundInteraction`, `CompoundBiomarkerEffect`, `CompoundStudyLink`), REST API, compound mixer UI, pathway browsing, recommendation engine, reviewer workflow.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| B7.1 | Create `lib/knowledge-graph/pubchem-ingest.ts` — fetch compound data from PubChem PUG REST API, map to `Compound` schema, check for duplicates by CID/name, upsert | 4–6 h | PubChem API (free) | planned |
| B7.2 | Create `lib/knowledge-graph/drugbank-ingest.ts` — parse DrugBank XML or use DrugBank API (requires academic/commercial license), extract interactions, pathways, biomarker effects | 4–6 h | DrugBank API key ($) | planned |
| B7.3 | Create ingest pipeline script `scripts/kg-ingest.ts` — orchestrate bulk ingest from PubChem + DrugBank, handle rate limits, log progress, idempotent upserts | 3–4 h | B7.1, B7.2 | planned |
| B7.4 | Create `app/api/knowledge-graph/contribute/route.ts` — community contribution endpoint: authenticated users propose new pathway links, interactions, or study citations. Creates `PendingGraphContribution` with status `PENDING` | 3–4 h | — | planned |
| B7.5 | Add `PendingGraphContribution` Prisma model (contributorId, entityType, payload JSON, status, reviewerId, reviewedAt, reviewNotes) | 30 min | — | planned |
| B7.6 | Create `app/api/knowledge-graph/contribute/[id]/review/route.ts` — admin/reviewer endpoint to approve/reject contributions with notes. On approval, apply to KG and credit contributor | 2–3 h | B7.4, B7.5 | planned |
| B7.7 | Create `components/knowledge-graph/contribute-form.tsx` — UI for proposing new compound-pathway links with study citation (DOI), interaction type, evidence level | 3–4 h | B7.4 | planned |
| B7.8 | Create `components/knowledge-graph/graph-visualisation.tsx` — interactive force-directed graph using `react-force-graph-2d`: compounds as nodes, pathways as clusters, interactions as edges, click to drill down | 6–8 h | `react-force-graph-2d` | planned |
| B7.9 | Create AI-derived relationship discovery — `lib/knowledge-graph/ai-linker.ts`: batch-process unlinked compounds through AI to suggest potential pathway connections with confidence scores, queue for human review | 4–6 h | AI provider | planned |
| B7.10 | Add KG statistics dashboard panel: total compounds, pathways, interactions, community contributions, coverage gaps | 2 h | — | planned |
| B7.11 | (Long-term) Evaluate Neo4j/Amazon Neptune for graph-native queries: path traversal, shortest paths between compounds, cluster analysis. Build adapter layer behind `lib/knowledge-graph/graph-adapter.ts` | 1–2 w | Neo4j or Neptune ($) | planned |
| B7.12 | Tests: ingest idempotency, contribution workflow, AI linker mock, graph data integrity | 3–4 h | B7.1–B7.9 | planned |

**Total estimated effort: 2–3 weeks**

---

### 8. Anonymised Outcome Data Flywheel

**Current coverage: ~90%** — k-anonymity (k≥5) with quasi-identifier generalisation, differential privacy (Laplace noise), statistics module (t-test, chi-square, CI, Cohen's d), outcome aggregator with consent-gated pipeline, aggregate insights API, recommendation engine wired to aggregate outcomes, insights dashboard UI, Vercel Cron nightly aggregation.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| B8.1 | Create `lib/anonymization/k-anonymity.ts` — implement k-anonymity (k≥5): suppress quasi-identifiers (exact age → decade bucket, location → region), generalise demographics, validate k threshold before releasing aggregates | 4–6 h | — | **done** |
| B8.2 | Create `lib/anonymization/differential-privacy.ts` — Laplace noise mechanism for aggregate statistics (mean bio-age, mean outcome score), configurable epsilon, sensitivity calculation per metric | 3–4 h | — | **done** |
| B8.3 | Create `AggregateOutcome` Prisma model (protocolId, compoundId, cohortBucket, sampleSize, meanOutcomeScore, stdDev, pValue, confidence, period, computedAt) | 30 min | — | **done** |
| B8.4 | Create `lib/flywheel/outcome-aggregator.ts` — scheduled job that: (1) queries consented users' outcome scores, (2) applies k-anonymity + DP noise, (3) computes per-protocol and per-compound aggregate stats, (4) persists to `AggregateOutcome` | 6–8 h | B8.1, B8.2, B8.3 | **done** |
| B8.5 | Create `app/api/insights/aggregate/route.ts` — public (or auth-gated) endpoint returning aggregate outcomes: "Users on Rapamycin + NMN saw 12% bio-age improvement (n=47, p<0.05)" | 2–3 h | B8.4 | **done** |
| B8.6 | Wire aggregates into `generateRecommendations()` — boost recommendation confidence when aggregate outcomes support a protocol for the user's cohort | 2–3 h | B8.5, existing recs engine | **done** |
| B8.7 | Create `components/insights/aggregate-outcomes.tsx` — UI cards showing population-level insights with sample size, confidence intervals, privacy guarantees displayed | 3–4 h | B8.5 | **done** |
| B8.8 | Create `app/insights/page.tsx` — public insights dashboard: top protocols by outcome, trending compounds, cohort comparisons | 3–4 h | B8.7 | **done** |
| B8.9 | Add consent gate — only include users who granted `research-usage` consent in aggregation; show consent prompt when accessing insights | 1–2 h | Existing consent system | **done** |
| B8.10 | Statistical significance module — `lib/flywheel/statistics.ts`: t-test, chi-square, confidence intervals, effect size (Cohen's d). Flag "preliminary" when n < 30 | 3–4 h | `jstat` or custom | **done** |
| B8.11 | Create Vercel Cron or external scheduler config for nightly aggregation runs | 1 h | B8.4 | **done** |
| B8.12 | Tests: k-anonymity validation, DP noise bounds, aggregation correctness, consent gating, statistical calculations | 4–6 h | B8.1–B8.10 | **done** |

**Total estimated effort: 2–3 weeks**

---

### 9. Clinician-in-the-Loop Network

**Current coverage: ~65%** — full telemedicine lifecycle (request → schedule → start → complete), clinician tasks, trust scoring, RBAC enforcement (`CLINICIAN` role), provider listing UI.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| B9.1 | Create clinician onboarding flow — `app/clinician/onboard/page.tsx`: credential upload (medical license, board certifications), specialisation selection (longevity medicine, functional medicine, endocrinology, etc.), availability schedule | 4–6 h | — | planned |
| B9.2 | Add `ClinicianProfile` Prisma model (userId, licenseNumber, licenseState, specializations Json, boardCertifications Json, verificationStatus, verifiedAt, verifierId, availabilitySchedule Json, bio, yearsExperience, consultationRate) | 1 h | — | planned |
| B9.3 | Create `lib/clinician/credential-verification.ts` — integration with credential verification API (NPPES NPI Registry for US) or manual admin review workflow | 3–4 h | NPPES API (free) | planned |
| B9.4 | Create clinician-patient matching algorithm — `lib/clinician/matching.ts`: match by specialization relevance to patient's health goals, availability overlap, trust score, patient preference, consultation rate budget | 4–6 h | B9.2, existing trust engine | planned |
| B9.5 | Create `components/clinician/clinician-card.tsx` — profile card with name, specializations, trust/reputation score, number of consultations, rating, rate, "Book Consultation" CTA | 2–3 h | B9.2 | planned |
| B9.6 | Create `components/clinician/clinician-directory.tsx` — searchable/filterable directory of verified clinicians with sorting by trust score, specialization, availability | 3–4 h | B9.5 | planned |
| B9.7 | Create post-consultation patient rating system — `app/api/telemedicine/consultations/[id]/rate/route.ts`: 1-5 star rating + optional text feedback, rolls into clinician trust score | 2–3 h | existing trust engine | planned |
| B9.8 | Create clinician protocol publishing — `app/api/clinician/protocols/route.ts`: clinicians can create and share evidence-based protocols with their patients. `ClinicianProtocol` model linked to `TelehealthProvider` | 3–4 h | B9.2 | planned |
| B9.9 | Create `components/clinician/protocol-card.tsx` — browsable clinician-authored protocols with evidence citations, trust score of author | 2 h | B9.8 | planned |
| B9.10 | Integrate video/chat for real-time consultations — evaluate Daily.co or Twilio Video SDK, create `components/telemedicine/video-room.tsx` and signalling API | 1–2 w | Daily.co or Twilio ($) | planned |
| B9.11 | Create clinician dashboard — `app/clinician/dashboard/page.tsx`: pending tasks, upcoming sessions, patient list, earnings summary, trust score trend | 4–6 h | B9.2, existing clinician-tasks | planned |
| B9.12 | Tests: credential verification flow, matching algorithm, rating integration with trust score, protocol CRUD, onboarding validation | 4–6 h | B9.1–B9.8 | planned |

**Total estimated effort: 2–3 weeks**

---

### 10. SOC 2 Type II Certification

**Current coverage: ~80%** — hash-chained immutable audit trail, RBAC on all admin routes, GDPR consent, MFA, tenant isolation, session governance, impersonation controls, CodeQL + Trivy + Dependabot in CI.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| B10.1 | Create `docs/SOC2-CONTROLS-MAPPING.md` — map existing controls to SOC 2 Trust Service Criteria (CC1–CC9, availability, confidentiality, processing integrity, privacy). Document evidence location for each control | 4–6 h | — | planned |
| B10.2 | Create automated compliance report generator — `scripts/compliance-report.ts`: query audit logs, count control violations, generate PDF/HTML report showing control effectiveness over a period | 6–8 h | — | planned |
| B10.3 | Create `docs/INCIDENT-RESPONSE-RUNBOOK.md` — SOC 2 format: detection, triage, containment, eradication, recovery, post-mortem template. Link to alerting/monitoring infrastructure | 2–3 h | — | planned |
| B10.4 | Automate data retention in production — create Vercel Cron config calling existing `scripts/orchestration-retention.ts` on a nightly schedule with configurable retention periods per data class | 1–2 h | Vercel Cron | planned |
| B10.5 | Add encryption at rest documentation — verify provider-level encryption (Vercel Postgres, Supabase, or RDS) and document encryption keys, key rotation policy | 1–2 h | — | planned |
| B10.6 | Create `docs/CHANGE-MANAGEMENT-POLICY.md` — document PR review requirements, CI gate requirements, deployment approval flow, rollback procedures | 2 h | — | planned |
| B10.7 | Create `SECURITY.md` in repo root — responsible disclosure policy, security contact, PGP key, scope, safe harbour statement | 1 h | — | planned |
| B10.8 | Add Row-Level Security (RLS) policies in PostgreSQL for tenant isolation (supplements existing `scopedDb()` application-level filtering) | 3–4 h | PostgreSQL (prod) | planned |
| B10.9 | Add SBOM generation to CI — `npx @cyclonedx/cyclonedx-npm --output-file sbom.json`, archive as build artifact | 1 h | `@cyclonedx/cyclonedx-npm` | planned |
| B10.10 | Engage SOC 2 Type II auditor — select audit firm, scope audit, provide evidence package, complete readiness assessment | — | Budget ($15–50K) | planned |
| B10.11 | (Optional) Integrate compliance automation platform (Vanta or Drata) to continuously monitor controls and auto-generate evidence | 1–2 d | Vanta/Drata ($) | planned |

**Total estimated effort: 1–2 weeks (code/docs) + external audit engagement**

---

### 11. AeonForge as API-as-a-Service

**Current coverage: ~50%** — complete internal engine (discovery, simulation, virtual twin), 3 API routes with rate limiting, tier gating (explorer/pro/enterprise), 52+ tests, AI governance + audit. But authentication is session-only, no external API layer.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| B11.1 | Create API key management — `APIKey` Prisma model (keyHash, prefix, organizationId, scopes, rateLimit, createdAt, lastUsedAt, expiresAt, revokedAt). `lib/api-keys/manager.ts`: generate, hash (SHA-256, store hash only), validate, revoke, rotate | 4–6 h | — | planned |
| B11.2 | Create `app/api/v1/auth/keys/route.ts` — authenticated endpoint for creating/listing/revoking API keys. Key returned only once on creation | 2–3 h | B11.1 | planned |
| B11.3 | Create API key authentication middleware — `lib/api-keys/middleware.ts`: extract `Authorization: Bearer ak_...` header, validate against hashed keys, attach organisation context, enforce scopes | 2–3 h | B11.1 | planned |
| B11.4 | Create external API routes under `app/api/v1/aeonforge/` — `discover/route.ts`, `simulate/route.ts`, `virtual-twin/route.ts`. Use API key auth, delegate to existing services, return structured JSON responses | 4–6 h | B11.3, existing services | planned |
| B11.5 | Create per-call usage metering — `APIUsageRecord` Prisma model (keyId, endpoint, tokens, computeMs, createdAt). `lib/api-keys/metering.ts`: record each call, aggregate for billing | 3–4 h | B11.1 | planned |
| B11.6 | Integrate usage-based billing with Stripe — `lib/api-keys/billing.ts`: Stripe Usage Records API, metered billing per API call, tier-based pricing (free: 100 calls/mo, pro: 10K calls/mo, enterprise: custom) | 4–6 h | Stripe metered billing | planned |
| B11.7 | Create developer portal — `app/developers/page.tsx`: API documentation (endpoint reference, request/response examples, rate limits, authentication guide), interactive playground, SDK download | 1–2 d | B11.4 | planned |
| B11.8 | Generate OpenAPI spec — create `lib/api-keys/openapi.ts` using `next-swagger-doc` or manual spec, serve at `/api/v1/openapi.json`, render with Swagger UI or Redoc | 4–6 h | B11.4 | planned |
| B11.9 | Create sandbox mode — `lib/api-keys/sandbox.ts`: sandbox API keys return mock/cached responses without consuming AI provider tokens, useful for integration testing | 2–3 h | B11.1 | planned |
| B11.10 | Create API usage dashboard — `app/developers/usage/page.tsx`: charts showing calls/day, tokens consumed, costs, rate limit headroom, key management | 4–6 h | B11.5 | planned |
| B11.11 | Create TypeScript SDK — `packages/aeonforge-sdk/`: typed client wrapping v1 API, published to npm. Methods: `discover()`, `simulate()`, `virtualTwin()`, `listCandidates()` | 2–3 d | B11.4 | planned |
| B11.12 | Create Python SDK — `packages/aeonforge-sdk-python/`: typed client with `httpx`, published to PyPI | 2–3 d | B11.4 | planned |
| B11.13 | Rate limiting per API key — extend existing `lib/rate-limit.ts` to support per-key limits from `APIKey.rateLimit` field | 2 h | B11.1 | planned |
| B11.14 | Tests: key generation/validation/revocation, metering accuracy, billing integration, sandbox responses, SDK integration tests | 4–6 h | B11.1–B11.9 | planned |

**Total estimated effort: 3–4 weeks**

---

### 12. Federated Learning

**Current coverage: ~85%** — full TypeScript FL infrastructure: DP-SGD gradient privacy, secure aggregation, FL client adapter for Flower server, server config + strategies, model registry API, participation API with consent gating, consent gate component, admin FL dashboard, recommendations blending, whitepaper. External Flower Python server is the interface boundary (not deployed here). 34 tests passing, 0 type errors.

| # | Task | Effort | Deps | Status |
|---|---|---|---|---|
| B12.1 | Evaluate federated learning framework — compare Flower (Python, production-ready), PySyft (research-grade), TensorFlow Federated (Google ecosystem). Recommendation: **Flower** for simplicity + production readiness | 2–4 h | Research | ✅ done |
| B12.2 | Create FL server configuration — `lib/fl/server-config.ts`: FedAvg/FedProx/FedAdam strategies, model architectures, hyperparameters, config builder. Python Flower server is external microservice (HTTP adapter) | 1–2 w | `flwr` | ✅ done |
| B12.3 | Define federated learning model architectures — `mlp-3-64` (8641 params), `mlp-2-128` (23169 params), `mlp-4-32` (3553 params). Input: 50-dim biomarker features, output: bio-age delta | 3–5 d | B12.2 | ✅ done |
| B12.4 | Create FL client adapter — `lib/fl/client.ts`: TypeScript HTTP adapter to Flower server. Types: BioAgeDeltaFeatures, LocalTrainingResult, TrainingTask, FLPrediction, FLServerStatus. Never sends raw health data | 1–2 w | B12.2, B12.3 | ✅ done |
| B12.5 | Implement differential privacy for FL — `lib/fl/gradient-privacy.ts`: DP-SGD (gradient clipping + Gaussian noise), Box-Muller sampling with crypto randomness, composed epsilon accounting, per-step budget | 3–5 d | B12.4 | ✅ done |
| B12.6 | Create secure aggregation — `lib/fl/secure-aggregation.ts`: SHA-256 mask generation, commitment verification, client-side masking, server-side masked mean aggregation | 1–2 w | B12.2 | ✅ done |
| B12.7 | Create model registry — `FederatedModel` + `FLParticipation` Prisma models. `app/api/fl/models/route.ts`: GET (list by taskType/status) + POST (admin: register with auto-increment version) | 2–3 h | B12.2 | ✅ done |
| B12.8 | Create FL consent flow — `components/fl/fl-consent-gate.tsx`: explains local vs shared data, checks `research-usage` consent, links to consent page. API enforces consent at `app/api/fl/participate/route.ts` | 2–3 h | Existing consent system | ✅ done |
| B12.9 | Create FL training dashboard — `app/admin/fl/page.tsx`: model registry table, privacy budget bar (ε progress), participation stats, server config display, recent participation log | 4–6 h | B12.7 | ✅ done |
| B12.10 | Wire FL model predictions into recommendation engine — `lib/analytics/recommendations.ts`: `FLPredictionRecord` type, confidence ≥ 0.5 boosts relevance up to 15%, high-confidence upgrades evidence quality | 3–5 d | B12.7, recs engine | ✅ done |
| B12.11 | Create FL tests — `__tests__/federated-learning.test.ts`: 34 tests covering gradient privacy (12), secure aggregation (10), server config (6), client types (2), recommendation blending (4) | 3–5 d | B12.2–B12.6 | ✅ done |
| B12.12 | Create `docs/FEDERATED-LEARNING-WHITEPAPER.md` — architecture, DP-SGD math, composition theorem, secure aggregation protocol, threat model, compliance mapping, references | 1–2 d | B12.1–B12.6 | ✅ done |

**Total estimated effort: 2–3 months (significant ML infrastructure build)**

---

## Summary Matrix

| # | Feature | Current | Target | Effort | Priority |
|---|---|---|---|---|---|
| A1 | PWA / Mobile App | ~5% | 90% | 1–2 d | **P0** |
| A2 | Wearable Integrations | ~30% | 85% | 1–2 w | **P1** |
| A3 | Biological Age Score | ~40% | 95% | 2–3 d | **P0** |
| A4 | Onboarding / Personalization | ~20% | 90% | 3–5 d | **P1** |
| A5 | Gamification / Streaks | ~10% | 85% | 4–6 d | **P1** |
| A6 | Social Sharing | ~10% | 80% | 2–3 d | **P2** |
| B7 | Knowledge Graph at Scale | ~70% | 95% | 2–3 w | **P1** |
| B8 | Outcome Data Flywheel | ~35% | 80% | 2–3 w | **P2** |
| B9 | Clinician-in-the-Loop | ~65% | 90% | 2–3 w | **P1** |
| B10 | SOC 2 Type II | ~80% | 95% | 1–2 w | **P1** |
| B11 | AeonForge API-as-a-Service | ~50% | 90% | 3–4 w | **P2** |
| B12 | Federated Learning | 0% | 70% | 2–3 mo | **P3** | ✅ ~85% |

## Recommended Implementation Order

### Sprint 1 (Week 1–2): Quick Wins — Close Obvious Gaps
- **A3** Biological Age Score (2–3 days) — highest user impact, reuses existing virtual twin
- **A1** PWA (1–2 days) — immediate mobile improvement, no backend changes
- **B10.7** SECURITY.md (1 hour) — table stakes

### Sprint 2 (Week 3–4): Core Engagement Loop
- **A4** Onboarding Wizard (3–5 days) — improves first-experience dramatically
- **A5** Gamification (4–6 days) — drives daily retention

### Sprint 3 (Week 5–8): Moat Infrastructure
- **A2** Wearable Integrations via Terra (1–2 weeks) — real-time data differentiator
- **B7** Knowledge Graph Scale (2–3 weeks, start with PubChem ingest + community contributions)
- **B9** Clinician Network (2–3 weeks, start with onboarding + matching + ratings)

### Sprint 4 (Week 9–12): Revenue + Compliance
- **B11** AeonForge API-as-a-Service (3–4 weeks) — second revenue stream
- **B10** SOC 2 controls mapping + auditor engagement (1–2 weeks code, then external)

### Sprint 5 (Week 13–16): Growth + Network Effects
- **A6** Social Sharing + Referrals (2–3 days)
- **B8** Outcome Data Flywheel (2–3 weeks) — grows with user base

### Sprint 6+ (Month 5+): Advanced ML
- **B12** Federated Learning (2–3 months) — long-term defensibility

---

**Total items: 127 tasks across 12 features**
**Estimated total effort: ~5–6 months with a 2-person team, or ~3–4 months with 3–4 developers**
