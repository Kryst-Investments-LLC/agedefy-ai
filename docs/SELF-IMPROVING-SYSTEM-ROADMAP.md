# Biozephyra — Self-Improving Biomedical System Roadmap

> **Vision**: A self-improving biomedical engine that runs continuous loops across
> biomarkers, protocols, and digital twins — not a static platform with AI features.
>
> **Architecture**: OBSERVE → PLAN → ACT → REFLECT → REPEAT × 5 concurrent sub-loops.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Partially implemented (scaffolding exists) |
| `[x]` | Complete |

---

## Summary: What the 5 Tiers Deliver

| Tier | Unlocks | Duration |
|------|---------|----------|
| **1 — REPEAT** | System becomes reactive — every data event triggers a loop automatically | 1–2 weeks |
| **2 — REFLECT** | System starts learning — each cycle calibrates the next | 2–4 weeks |
| **3 — PLAN** | System becomes adaptive — different patients trigger different investigation paths | 2–3 weeks |
| **4 — ACT** | System can autonomously draft interventions (human approval gates remain) | 2–3 weeks |
| **5 — MECH** | System builds a personalized mechanistic model per user | 3–5 weeks |
| **Moats** | Platform becomes defensible — unforkable data + distribution advantages | 6–18 months |

---

## Hard Constraints (must be respected across all tiers)

- Every autonomous agent action that affects a user's protocol or doses requires either
  user confirmation or clinician approval before application. Draft ≠ applied.
- Output is always labeled CANDIDATES / LEADS / HYPOTHESES — never "cure," "treatment,"
  "therapy," or "dose."
- Every agent result carries: "AI-generated hypothesis — requires validation. Not medical advice."
- Discovery agent (`lib/agents/discovery-agent.ts`) is a FORBIDDEN PATH — must not be
  modified or routed into for any tier work.
- No personal health data used to rank or suggest compounds/protocols to consumer users.
- All new agents must be gated behind RESEARCHER or CLINICIAN role.

---

## Tier 1 — Unlock the REPEAT Loop

> **Goal**: Turn one-shot API calls into a continuously running loop. Every ingest event
> triggers the full OBSERVE → PLAN → ACT → REFLECT cycle automatically.

### 1.1 — LoopCycle persistence (DB schema)

- [ ] Add `LoopCycle` table to `prisma/schema.prisma`
  - Fields: `id`, `userId`, `tenantId`, `status` (enum: `observe | plan | act | reflect | complete | failed`),
    `triggeredBy` (enum: `biomarker_ingest | lab_result | wearable_sync | protocol_change | scheduled | manual`),
    `snapshotId` (FK → `PhysiologicalSnapshot`), `agentSessionId` (FK → existing `AgentSession`),
    `startedAt`, `completedAt`, `failedReason`
- [ ] Add `PhysiologicalSnapshot` table to `prisma/schema.prisma`
  - Fields: `id`, `userId`, `tenantId`, `materializedAt`, `biomarkersJson`, `riskScoresJson`,
    `activeProtocolId`, `protocolAdherence`, `protocolWeeksActive`, `dysregulatedPathwaysJson`,
    `twinLastSimAt`, `twinPredictionAccuracy`, `pendingReflectionsJson`
- [ ] Write migration: `prisma/migrations/YYYYMMDD_loop_cycle_and_snapshot/migration.sql`
- [ ] Update `prisma/schema.prisma` relations: `User → LoopCycle[]`, `User → PhysiologicalSnapshot[]`

### 1.2 — PhysiologicalSnapshot materializer

- [ ] Create `lib/loop/snapshot-materializer.ts`
  - Function `materializeSnapshot(userId: string, tenantId: string): Promise<PhysiologicalSnapshot>`
  - Reads: latest biomarker records per type, active protocol + adherence, latest digital twin sim, current risk flags from safety agent
  - Computes: trend direction per biomarker (improving / stable / worsening) using last 3 values
  - Writes: upserts `PhysiologicalSnapshot` row in DB, returns it
  - Must never throw — wrap in try/catch, log failures
- [ ] Create `lib/loop/pathway-state.ts`
  - Function `identifyDysregulatedPathways(snapshot: PhysiologicalSnapshot): string[]`
  - Lookup table: biomarker thresholds → pathway names (e.g., CRP > 3.0 → 'NF-kB', fasting glucose > 100 → 'insulin-resistance', NAD < threshold → 'AMPK')
  - Returns ranked list of dysregulated pathways for the planning agent
- [ ] Write unit tests: `__tests__/snapshot-materializer.test.ts` (mock DB, assert snapshot shape)

### 1.3 — Event-driven loop trigger

- [ ] Create `lib/loop/loop-trigger.ts`
  - Function `triggerLoopCycle(input: { userId: string; tenantId: string; reason: LoopTriggerReason }): Promise<void>`
  - Creates a `LoopCycle` row with status `observe`
  - Enqueues `loop:observe` job to `scripts/orchestration-worker.ts`
  - Idempotent within a 5-minute window per user (prevent duplicate triggers on rapid ingest)
- [ ] Modify `app/api/biomarkers/route.ts` — after persisting biomarker event, call `triggerLoopCycle({ reason: 'biomarker_ingest' })`
- [ ] Modify `app/api/lab-testing/results/route.ts` — after persisting result, call `triggerLoopCycle({ reason: 'lab_result' })`
- [ ] Modify `app/api/wearables/webhook/route.ts` — after persisting wearable data, call `triggerLoopCycle({ reason: 'wearable_sync' })`
- [ ] Modify `app/api/protocols/route.ts` — after persisting protocol change, call `triggerLoopCycle({ reason: 'protocol_change' })`
- [ ] Modify `scripts/orchestration-worker.ts` — add handler for `loop:observe` job
  - Calls `materializeSnapshot` → advances `LoopCycle` status to `plan` → enqueues `loop:plan`
- [ ] Write unit tests: `__tests__/loop-trigger.test.ts` (mock DB, assert idempotency, assert job enqueue)

### 1.4 — Loop worker pipeline

- [ ] Add `loop:observe` job handler in `scripts/orchestration-worker.ts`
  - Materialize snapshot → status = `plan`
- [ ] Add `loop:plan` job handler
  - Run supervisor/planning agent (see Tier 3) → status = `act`
- [ ] Add `loop:act` job handler
  - Execute agent session → status = `reflect`
- [ ] Add `loop:reflect` job handler (implementation in Tier 2) → status = `complete`
- [ ] Add error handler: on any job failure → status = `failed`, log `failedReason`
- [ ] Write integration test: `__tests__/loop-pipeline.test.ts` — mock all agents, assert full status progression

### 1.5 — Loop status API

- [ ] Create `app/api/v1/loop/[userId]/route.ts`
  - `GET`: returns last 10 `LoopCycle` rows for userId (admin + the user themselves)
  - `POST`: manually trigger a loop cycle (for testing / clinician override)
  - Auth: session required; admin or own userId only
- [ ] Write test: `__tests__/loop-status-route.test.ts`

---

## Tier 2 — Build the REFLECT Loop

> **Goal**: At the end of every cycle, measure what actually happened vs what was predicted.
> Feed the delta back into agent calibration. This is what makes the system self-improving.

### 2.1 — ProtocolOutcome schema

- [ ] Add `ProtocolOutcome` table to `prisma/schema.prisma`
  - Fields: `id`, `userId`, `tenantId`, `loopCycleId` (FK), `protocolId` (FK), `cycleStartDate`,
    `cycleEndDate`, `targetBiomarkers` (JSON: `{ name, predictedDelta, predictedDirection }`),
    `observedBiomarkers` (JSON: `{ name, observedDelta, observedDirection, confidence }`),
    `twinSimulationId` (FK to `DigitalTwinRun`), `twinPredictionAccuracy` (Float),
    `agentAccuracyScores` (JSON: `{ agentName, claimsMade, claimsValidated, score }`),
    `overallEfficacy` (Float: 0–1), `reflectedAt`
- [ ] Write migration: `prisma/migrations/YYYYMMDD_protocol_outcome/migration.sql`
- [ ] Create `lib/loop/outcome-writer.ts`
  - Function `writeProtocolOutcome(loopCycleId: string): Promise<ProtocolOutcome>`
  - Joins: protocol prediction (from session scratchpad) + biomarker observations since cycle start
  - Computes: per-biomarker delta vs prediction, per-agent accuracy score
  - Writes: `ProtocolOutcome` row
- [ ] Write unit tests: `__tests__/outcome-writer.test.ts`

### 2.2 — Scientific Reflection Agent

- [ ] Create `lib/agents/reflection-agent.ts`
  - Input: `{ loopCycleId, protocolOutcome: ProtocolOutcome, snapshot: PhysiologicalSnapshot }`
  - Evaluates:
    - Did biomarkers move in predicted direction? (per target)
    - By how much relative to prediction? (accuracy ratio)
    - Which agents made accurate predictions vs false positives?
    - Were there unexpected adverse signals?
    - Was digital twin prediction accurate? (within ±15%?)
  - Output: `ReflectionReport` with `{ insights: string[], agentScoreDeltas: Record<string, number>, twinAccuracyDelta: number, recommendedPriorAdjustments: PriorAdjustment[] }`
  - Framing constraint: all reflection output must be labeled "retrospective research analysis — not medical advice"
  - Must NOT access `lib/agents/discovery-agent.ts`
- [ ] Create `app/api/agents/reflect/route.ts`
  - POST: trigger reflection for a completed loop cycle
  - Auth: RESEARCHER or CLINICIAN role required
  - Returns: `ReflectionReport` with W3C VC signed via `lib/provenance/sign-result.ts`
- [ ] Add `ReflectionReport` table to schema (persisted per cycle)
- [ ] Write tests: `__tests__/reflection-agent.test.ts` (mock DB + AI, assert all output branches)

### 2.3 — Digital twin accuracy scoring

- [ ] Modify `lib/agents/digital-twin.ts`
  - After persisting a sim run, record: `{ simulationId, userId, compoundIds, predictedOutcomesJson, predictionDate }`
  - Add DB column: `DigitalTwinRun.predictionWindowDays` (how far ahead the prediction applies)
- [ ] Create `lib/loop/twin-scorer.ts`
  - Function `scoreTwinPrediction(simulationId: string): Promise<TwinAccuracyScore>`
  - Fetches: the stored prediction from `DigitalTwinRun`
  - Fetches: actual biomarker observations in the prediction window
  - Computes: per-outcome accuracy (predicted direction correct? magnitude within 20%?)
  - Writes: `TwinAccuracyScore` row (`{ simulationId, userId, accuracyRatio, biomarkerScoresJson, scoredAt }`)
- [ ] Write tests: `__tests__/twin-scorer.test.ts`

### 2.4 — FallbackEffect prior updater

- [ ] Create `lib/agents/twin-priors.ts`
  - `getEffectPriors(userId: string, compoundId: string): Promise<FallbackEffect>`
    - Returns user-specific priors if they exist (from `UserTwinPrior` table), else falls back to
      the hard-coded defaults in `digital-twin-agent.ts`
  - `updateEffectPrior(userId: string, compoundId: string, delta: PriorAdjustment): Promise<void>`
    - Applies Bayesian update: new_prior = (n × old_prior + observed) / (n + 1)
    - Writes to `UserTwinPrior` table
    - Bounded to ±50% of population default (prevents runaway personalization)
- [ ] Add `UserTwinPrior` table to schema: `{ userId, compoundId, outcomeKey, prior, n, updatedAt }`
- [ ] Modify `lib/agents/digital-twin-agent.ts` — replace hard-coded `FALLBACK_EFFECTS` constant with call to `getEffectPriors(userId, compoundId)`
- [ ] Call `updateEffectPrior` from reflection agent when a `PriorAdjustment` is recommended
- [ ] Write tests: `__tests__/twin-priors.test.ts` (assert Bayesian update math, assert bounds)

### 2.5 — Reflection loop trigger

- [ ] Modify `lib/loop/loop-trigger.ts` — add scheduled reflection trigger
  - When `LoopCycle` moves to `reflect` status, invoke `reflection-agent.ts`
  - After reflection completes, call `updateEffectPrior` for each adjustment
  - Advance cycle to `complete`
- [ ] Add cron job in `scripts/orchestration-worker.ts`: daily sweep for completed protocol cycles (cycleEndDate passed, outcome not yet written) → trigger reflection
- [ ] Write test: `__tests__/reflection-loop.test.ts`

---

## Tier 3 — Upgrade PLAN to Clinical Reasoning Engine

> **Goal**: Replace the fixed supervisor agent sequence with adaptive clinical reasoning.
> Different physiological states trigger different investigation paths.

### 3.1 — Clinical Planning Agent

- [ ] Create `lib/agents/clinical-planning-agent.ts`
  - Input: `{ snapshot: PhysiologicalSnapshot, recentReflections: ReflectionReport[] }`
  - Reasons about:
    - Which pathways are most dysregulated (from snapshot)
    - Which investigations have highest expected value (uncertainty × importance)
    - Which sub-agents to spawn and in what order
    - What the protocol agent should focus on vs what to skip
    - Whether a digital twin simulation is warranted (or whether prior data is sufficient)
  - Output: `InvestigationPlan { priorityPathways: string[], agentSequence: AgentStep[], skipAgents: string[], rationale: string }`
  - Framing: all rationale labeled "AI-generated research analysis — requires expert validation"
  - Must NOT use user personal data to rank compound suggestions
- [ ] Modify `lib/agents/supervisor.ts`
  - Before building the fixed 5-agent plan, check if `ClinicalPlanningAgent` produces an
    `InvestigationPlan`; if so, use its `agentSequence` instead of the default order
  - If planning agent fails, fall back to current fixed sequence (no regression)
- [ ] Create `app/api/agents/plan/route.ts`
  - POST: generate an `InvestigationPlan` for a given userId (for preview / clinician review)
  - Auth: RESEARCHER or CLINICIAN role
- [ ] Write tests: `__tests__/clinical-planning-agent.test.ts`

### 3.2 — Pathway dysregulation classifier

- [ ] Extract and expand `lib/loop/pathway-state.ts` (created in Tier 1)
  - Add full lookup table covering: mTOR, AMPK, NF-kB, sirtuins, insulin signaling,
    mitochondrial function, telomere maintenance, senescence, HPA axis, GH/IGF-1, thyroid
  - Each pathway has: biomarker indicators, threshold rules, confidence score
  - Returns: `PathwayState[]` sorted by dysregulation severity
- [ ] Add LLM fallback: if biomarker set doesn't match any lookup rule, pass to Anthropic with
  structured prompt asking for pathway mapping — cache result by biomarker pattern hash
- [ ] Write tests: `__tests__/pathway-classifier.test.ts` (deterministic lookup + mock LLM fallback)

### 3.3 — Simulation priority queue

- [ ] Create `lib/loop/simulation-queue.ts`
  - Function `prioritizeSimulations(plan: InvestigationPlan, recentSims: DigitalTwinRun[]): SimulationPriority[]`
  - Scoring: `expected_value = uncertainty_score × pathway_importance × sim_freshness_decay`
  - Uncertainty score: 1 - twinPredictionAccuracy for that compound/pathway pair
  - Freshness decay: sims older than 30 days get +50% uncertainty bonus
  - Returns: ordered list of simulations to run, with estimated compute cost
  - Top-N (configurable, default 3) are auto-queued; rest wait for explicit trigger
- [ ] Modify `lib/agents/digital-twin-agent.ts` — read simulation priority queue before deciding
  which compounds to simulate in a batch session
- [ ] Write tests: `__tests__/simulation-queue.test.ts`

### 3.4 — Planning quality gate

- [ ] Modify `lib/agents/supervisor.ts` — after `ClinicalPlanningAgent` produces a plan,
  validate it: minimum 1 agent in sequence, no circular dependencies, no skipped safety agent
- [ ] Safety agent must always remain in the sequence regardless of planning output
- [ ] Clinician review gate must remain enforced for RED-tier outputs regardless of plan
- [ ] Write test: `__tests__/planning-quality-gate.test.ts`

---

## Tier 4 — Close the ACT Loop

> **Goal**: Agents can autonomously draft interventions. Drafts require approval — applied
> never means autonomous. Protocol changes go through the existing governance gates.

### 4.1 — Protocol version writer

- [ ] Add `ProtocolVersion` table to `prisma/schema.prisma`
  - Fields: `id`, `protocolId` (FK), `userId`, `version` (Int, auto-increment per protocol),
    `status` (enum: `draft | pending_approval | approved | rejected | applied`),
    `changes` (JSON: what changed from prior version and why), `generatedByAgentSessionId`,
    `approvedBy`, `approvedAt`, `appliedAt`
- [ ] Modify `lib/agents/protocol-agent.ts`
  - When plateau is detected or optimization is recommended, write a `ProtocolVersion` row
    with status `draft` instead of just returning a recommendation string
  - Do NOT modify the live protocol row until status reaches `applied`
- [ ] Create `app/api/protocols/[id]/versions/route.ts`
  - `GET`: list all versions for a protocol (with diffs)
  - `PATCH`: approve or reject a draft version (CLINICIAN or the protocol's owner)
  - `POST /apply`: apply an approved version (copies version data into live protocol row)
- [ ] Create notification: when a new `ProtocolVersion` with status `pending_approval` is created,
  enqueue a notification to the user and (if exists) their assigned clinician
- [ ] Write tests: `__tests__/protocol-version-writer.test.ts`

### 4.2 — Protocol cycle scheduler

- [ ] Add `protocolCycleLengthDays` (Int, default 28) and `protocolCycleStartDate` (DateTime)
  columns to the `Protocol` table in `prisma/schema.prisma`
- [ ] Create `lib/loop/cycle-scheduler.ts`
  - Function `scheduleNextReflection(protocolId: string): Promise<void>`
    - Reads `protocolCycleLengthDays` + `protocolCycleStartDate`
    - Schedules a `loop:reflect` job for `cycleStartDate + cycleLengthDays`
    - Writes a `LoopCycle` row with `triggeredBy: 'scheduled'` and `status: 'pending'`
  - Function `sweepExpiredCycles(): Promise<void>` — daily cron: find all protocols whose
    `cycleStartDate + cycleLengthDays <= today` and haven't triggered reflection yet
- [ ] Add scheduler call in `app/api/protocols/route.ts` — when a protocol is created or updated,
  call `scheduleNextReflection`
- [ ] Add `cycle-sweep` cron job in `scripts/orchestration-worker.ts`
- [ ] Write tests: `__tests__/cycle-scheduler.test.ts`

### 4.3 — Dosage optimizer

- [ ] Create `lib/agents/dosage-optimizer.ts`
  - Input: `{ userId, compoundId, pkProfile: UserPkProfile | null, observedBiomarkerResponse: BiomarkerDelta[], currentDose: number, currentUnit: string }`
  - Logic:
    - If `pkProfile` exists (from Tier 5): feed into `lib/agents/twin-strategies/pbpk-1cmt.ts` to
      compute optimal dose for target Cmax
    - If no `pkProfile`: use population average from PBPK model + observed response direction
  - Output: `DosageSuggestion { suggestedDose, unit, rationale, confidenceLevel, requiresClinician: true }`
  - `requiresClinician` is always `true` — this must never be applied without clinician sign-off
  - All output framing: "AI-generated dosage hypothesis — requires prescriber review and validation.
    Not a medical prescription."
  - Gate: CLINICIAN role required to see dosage suggestions; not exposed to consumer users
- [ ] Create `app/api/agents/dosage/route.ts`
  - POST: generate dosage suggestion for a compound + user (CLINICIAN role only)
  - Result signed with W3C VC via `lib/provenance/sign-result.ts`
- [ ] Write tests: `__tests__/dosage-optimizer.test.ts` (mock PBPK, assert framing, assert clinician gate)

### 4.4 — Periodic progress report

- [ ] Create `lib/reports/cycle-report.ts`
  - Function `generateCycleReport(loopCycleId: string): Promise<CycleReport>`
  - Reads: `ProtocolOutcome`, `ReflectionReport`, biomarker trends since cycle start
  - Produces: structured report with sections: biomarker summary, protocol performance,
    digital twin accuracy, agent findings, next-cycle recommendations
  - Format: both JSON (for API) and PDF (via existing `lib/wallet/digital-twin-pdf.ts` pattern)
- [ ] Create `app/api/reports/cycle/[loopCycleId]/route.ts`
  - GET: return cycle report (JSON or PDF via Accept header)
  - Auth: the user themselves or their clinician
- [ ] Enqueue report generation at end of `loop:reflect` job
- [ ] Write tests: `__tests__/cycle-report.test.ts`

---

## Tier 5 — Mechanistic Model Calibration

> **Goal**: Each user accumulates a personalized pharmacokinetic profile. The digital twin
> uses fitted parameters, not population averages. Predictions improve with each trial.

### 5.1 — Per-user PK parameter fitting

- [ ] Add `UserPkProfile` table to `prisma/schema.prisma`
  - Fields: `id`, `userId`, `compoundId`, `vd` (Float — volume of distribution), `cl` (Float — clearance),
    `ka` (Float — absorption rate), `n` (Int — number of observations used to fit), `rmse` (Float),
    `fittedAt`, `fittedFromOutcomeIds` (JSON: array of ProtocolOutcome IDs used)
- [ ] Create `lib/agents/pk-fitter.ts`
  - Function `fitPkProfile(userId: string, compoundId: string): Promise<UserPkProfile | null>`
  - Requires: ≥ 2 completed `ProtocolOutcome` records for this user × compound pair
  - Method: non-linear least squares fit of 1-cmt model (`pbpk-1cmt.ts`) to observed biomarker
    time series using the `observed_peak_time` and `observed_biomarker_deltas`
  - If fewer than 2 outcomes: returns null (fall back to population priors)
  - Writes fitted parameters to `UserPkProfile`
- [ ] Create `app/api/agents/pk-profile/[userId]/route.ts`
  - GET: retrieve PK profiles for a user (RESEARCHER or CLINICIAN role)
  - POST `/fit`: trigger a fitting run for a specific compound
- [ ] Write tests: `__tests__/pk-fitter.test.ts` (synthetic biomarker series, assert parameter bounds)

### 5.2 — Calibrated sidecar connection

- [ ] Modify `lib/sidecars.ts`
  - Add `sendUserPkProfile(userId: string, compoundId: string, profile: UserPkProfile): Promise<void>`
    — pushes fitted parameters to the Python mechanistic sidecar (if connected)
  - Add `requestCalibratedSimulation(params: CalibratedSimRequest): Promise<SimResult>`
    — calls sidecar with user-fitted PK params; falls back to in-process 1-cmt if sidecar unavailable
- [ ] Modify `lib/agents/digital-twin-agent.ts`
  - Before running simulation, check for `UserPkProfile` via `twin-priors.ts`
  - If profile exists: pass fitted params to sidecar via `requestCalibratedSimulation`
  - If no profile: use existing `getEffectPriors` flow (Tier 2 priors)
  - Log which path was taken in simulation metadata
- [ ] Write tests: `__tests__/calibrated-sidecar.test.ts` (mock sidecar, assert fallback path)

### 5.3 — Model prediction logging

- [ ] Modify `lib/agents/digital-twin.ts` — extend `DigitalTwinRun` storage
  - Store full input assumptions: `{ compoundIds, doses, baselineBiomarkers, pkParamsUsed, modelVersion }`
  - Store full output predictions: `{ outcomeTrajectories: { biomarker, predictedValues: [{ t, value }] } }`
  - Store `predictionWindowDays` (how far the prediction extends)
  - Add `predictionExpiresAt` = `createdAt + predictionWindowDays`
- [ ] Create `lib/loop/prediction-log-sweeper.ts`
  - Daily cron: find all `DigitalTwinRun` rows where `predictionExpiresAt <= today`
    and `twinAccuracyScore` is null → trigger `twin-scorer.ts` scoring
- [ ] Add `prediction-log-sweep` job to `scripts/orchestration-worker.ts`
- [ ] Write tests: `__tests__/prediction-log-sweeper.test.ts`

### 5.4 — Model version tracking

- [ ] Add `modelVersion` column to `DigitalTwinRun`: tracks which priors/sidecar version produced
  the prediction (for accuracy attribution across model versions)
- [ ] Create `lib/agents/model-registry.ts`
  - Tracks current model version string (sidecar version + prior version + schema version)
  - Bumped whenever priors are updated (Tier 2) or sidecar is upgraded
  - All `DigitalTwinRun` rows tagged with the model version at simulation time

---

## Moats — Strategic Defensibility Layer

> These are not required for the self-improving engine (tiers 1–5 deliver that).
> These are what make the platform unforkable.

### M1 — Federated Longitudinal Biomarker Graph

> Multi-tenant federated DB with differential privacy. Each new user makes predictions more
> accurate. Competitors would need fresh recruitment in every jurisdiction to replicate.

- [ ] Evaluate Substra vs NVIDIA FLARE vs PySyft for federation framework
- [ ] Define federation node architecture (who hosts nodes: clinic partners, labs, us)
- [ ] Add `FederatedNode` and `FederationConsent` tables to schema
- [ ] Implement differential privacy budget tracking per user per query
  - `UserPrivacyBudget { userId, epsilonUsed, epsilonMax, queries[] }`
  - Default: ε_max = 4.0 per user per month
  - Deduct budget on each aggregate query that uses their data
- [ ] Gate all aggregate queries through `lib/privacy/dp-engine.ts` (to be created)
  - Add Laplace noise scaled to sensitivity / epsilon
- [ ] Build federated query router: routes to local node if data is local, federated node otherwise
- [ ] Enforce k-anonymity ≥ 50 on all cohort-level outputs (via `audit-governance-agent`)
- [ ] Create admin dashboard: per-user privacy budget meter
- [ ] Write whitepaper entry: `docs/FEDERATED-LEARNING-WHITEPAPER.md` (update existing)
- **Effort**: 3–6 months | **Defensibility**: Highest — creates unforkable dataset

### M2 — Protocol Fork Social Graph

> Every protocol is versioned like code. Users fork protocols. Forks carry outcome
> measurements forward automatically. Creates a GitHub-for-protocols moat.

- [ ] Add `ProtocolFork` table: `{ id, sourceProtocolId, forkedByUserId, forkNote, createdAt }`
- [ ] Add `ProtocolFork` relation: `Protocol.forkedFrom (FK)`, `Protocol.forks: ProtocolFork[]`
- [ ] Create `app/api/protocols/[id]/fork/route.ts`
  - POST: clone protocol into forking user's library (deep copy, new ID, `forkedFrom` set)
  - Increment `forkCount` on source protocol
- [ ] Modify `lib/loop/outcome-writer.ts` — when writing `ProtocolOutcome`, propagate outcome
  summary (anonymized) to the source protocol's aggregate outcome ledger
- [ ] Create `app/api/protocols/trending/route.ts` — most-forked protocols, sorted by forkCount
  and aggregate efficacy score
- [ ] Build `components/protocol-fork-tree.tsx` — visualize fork lineage
- [ ] Build `components/protocol-leaderboard.tsx` — top protocols by outcomes
- [ ] Create researcher view: `app/researchers/protocols/page.tsx` — fork tree + aggregate outcomes
  (RESEARCHER role, all individual data de-identified before display)
- **Effort**: 6–8 weeks | **Defensibility**: High — social graph + outcome data hard to replicate

### M3 — Researcher Cohort Query DSL

> SQL-like DSL for IRB-approved researchers: query consented cohort biomarker data
> with k-anonymity, DP budgeting, and audit trail. "Bloomberg terminal for longevity research."

- [ ] Design query grammar: `COHORT WHERE ... AND ... RETURN AGG.median(...)`
  - Supported filters: `biomarkers.<name>.<aggregation>`, `protocols CONTAINS`, `user.consent`,
    `jurisdiction IN`, `age_bracket`, `sex`
  - Supported returns: `AGG.median`, `AGG.mean`, `AGG.count`, `AGG.percentile`
  - No row-level returns — only aggregates, k-anonymity enforced
- [ ] Create `lib/researcher/cohort-dsl-parser.ts` — parse DSL string to AST
- [ ] Create `lib/researcher/cohort-query-executor.ts`
  - Validates AST (no joins that could de-anonymize, k-anonymity floor check)
  - Applies DP noise (via M1 dp-engine)
  - Executes against federated graph (M1) or local DB with row-level suppression
  - Writes query + result hash to audit log
- [ ] Create `app/api/v1/researcher/cohort/route.ts`
  - POST: execute cohort DSL query
  - Auth: RESEARCHER role + active IRB token (new field on User: `irbApprovalToken`)
  - Rate limit: 10 queries/hour per researcher
  - Every query response includes: `{ result, suppressed_below_k_anonymity, epsilon_consumed, auditId }`
- [ ] Add `IrbApproval` table: `{ userId, token, approvedAt, expiresAt, institution, studyId }`
- [ ] Create `app/researchers/cohort-query/page.tsx` — query editor UI with syntax highlighting
- [ ] Write tests: `__tests__/cohort-dsl.test.ts` (parser tests, k-anonymity enforcement, DP noise)
- **Effort**: 6–8 weeks | **Defensibility**: High — once labs build methodology around our DSL, switching cost is prohibitive

### M4 — Differential Privacy Budget Meter (User-Facing)

> Surface a public privacy meter to users: "We spent ε=0.8 of your ε_max=4.0 this month."
> Crucial for EU/CA/UK regulatory acceptance and a marketing moat vs opaque competitors.

- [ ] Create `app/api/account/privacy-budget/route.ts`
  - GET: return current ε_used, ε_max, query_count, reset_date for the authenticated user
- [ ] Create `components/privacy-budget-meter.tsx`
  - Visual meter (like a battery) showing remaining privacy budget
  - Tooltip: explains what ε means in plain language
  - Shows: "Your data contributed to N research queries this month"
- [ ] Add privacy budget meter to user settings page or account dashboard
- [ ] Add privacy budget notification: email when budget > 80% consumed
- [ ] Document methodology in `docs/FEDERATED-LEARNING-WHITEPAPER.md`
- **Effort**: 2–3 weeks (requires M1 budget infrastructure) | **Defensibility**: Regulatory moat

### M5 — LLM Trace-Driven Distillation

> Mine production traces to fine-tune smaller models that replace expensive LLM calls on
> hot intents. Eval-feedback loop catches regressions automatically.

- [ ] Modify `lib/logger.ts` or `lib/observability/telemetry.ts` — write structured trace records
  for every AI provider call: `{ intent, inputTokens, outputTokens, model, latencyMs, cost,
  outputQualityScore (from reflection agent) }`
- [ ] Create `lib/distillation/trace-miner.ts`
  - Reads traces from `/traces/orchestrator.jsonl` (existing) + new structured logs
  - Filters: only traces where `outputQualityScore ≥ 0.85` (validated by reflection agent)
  - Exports: JSONL fine-tuning dataset with `{ prompt, completion }` pairs per intent cluster
- [ ] Create `scripts/distillation-export.ts` — CLI to export fine-tuning dataset per intent
- [ ] Add intent clustering: group traces by `{ agentClass, pathway, intent_type }` for targeted fine-tuning
- [ ] Create `lib/distillation/shadow-router.ts`
  - Shadow-route 5% of production traffic to distilled model in parallel
  - Compare quality scores between distilled vs full model
  - If distilled model scores within 3% of full model on target intent → promote to primary
- [ ] Wire shadow router into eval-feedback-loop GitHub workflow (existing)
- [ ] Write tests: `__tests__/trace-miner.test.ts`, `__tests__/shadow-router.test.ts`
- **Effort**: 4–6 weeks | **Defensibility**: Cost moat (10–20× cheaper per call at scale) + latency moat

### M6 — Auto-Trial Protocol Scaffolding

> Given a hypothesis, research-agent scaffolds the full trial: power calculation,
> inclusion/exclusion criteria, IRB boilerplate, endpoints, pre-registered analysis script.

- [ ] Create `lib/agents/trial-scaffolder.ts`
  - Input: `{ hypothesis: string, targetBiomarkers: string[], interventionCompoundIds: string[], jurisdiction: string[] }`
  - Uses: cohort DSL (M3) to estimate available N for power calculation
  - Outputs: `TrialScaffold { powerCalc, inclusionCriteria, exclusionCriteria, irbBoilerplate,
    primaryEndpoint, secondaryEndpoints, analysisScript, preregistrationDraftUrl }`
  - Framing: "AI-generated trial scaffold — requires IRB review and statistical expertise.
    Not a substitute for regulatory consultation."
  - Gate: RESEARCHER role only
- [ ] Create `app/api/agents/trial-scaffold/route.ts`
  - POST: generate scaffold (RESEARCHER role)
  - Result signed with W3C VC
  - IRB boilerplate varies by jurisdiction (uses existing `docs/legal/` jurisdiction files)
- [ ] Create `app/researchers/trial-scaffold/page.tsx` — scaffold generator UI
  - Step 1: enter hypothesis + target biomarkers
  - Step 2: select jurisdictions (shows available cohort N from M3)
  - Step 3: review generated scaffold with edit capability
  - Step 4: export as PDF / submit to pre-registration service
- [ ] Write tests: `__tests__/trial-scaffolder.test.ts`
- **Effort**: 8–10 weeks | **Defensibility**: First-mover on agent-native trial design

### M7 — Clinician Co-Sign as Productized Premium Tier

> Every recommendation can be co-signed by a licensed clinician (via telemedicine-agent
> integration). Creates auditable liability transfer record. Telehealth networks adopt us
> as their longevity backend.

- [ ] Add `ClinicianCoSign` table: `{ id, resourceType, resourceId, clinicianId, signature,
  signedAt, expiresAt, jurisdiction, licenseNumber, licenseVerifiedAt }`
- [ ] Modify `lib/agents/safety-agent.ts` — on YELLOW-tier recommendations, offer optional
  co-sign instead of mandatory escalation (co-sign upgrades to provisional approval)
- [ ] Create `app/api/clinician/co-sign/route.ts`
  - POST: create co-sign record with digital signature (CLINICIAN role + valid license)
  - GET: retrieve co-sign status for a resource
- [ ] Modify `lib/provenance/sign-result.ts` — add `cosignedBy` field to VC output when
  a `ClinicianCoSign` record exists for the resource
- [ ] Create `app/clinician/co-sign-queue/page.tsx` — clinician dashboard for pending co-signs
- [ ] Create `lib/licensing/license-verifier.ts`
  - Verifies clinician license via NPI lookup (US) or equivalent per jurisdiction
  - Caches verification for 30 days
- [ ] Add co-sign tier to billing (`lib/pricing.ts`): enterprise add-on at $X/month
- [ ] Write tests: `__tests__/clinician-cosign.test.ts`
- **Effort**: 3–4 weeks | **Defensibility**: Regulatory moat — telehealth networks need audit-trail

### M8 — Edge Inference (ONNX + WebGPU)

> Run entry-agent and i18n-agent on-device via ONNX + WebGPU. Cuts p99 by ~40%,
> removes a network hop, enables offline mode.

- [ ] Export `entry-agent` intent classifier to ONNX format (quantized INT8)
- [ ] Export `i18n-agent` locale detection model to ONNX format
- [ ] Create `lib/edge/onnx-runner.ts` (server-side ONNX Runtime for Node.js)
  - Wraps `onnxruntime-node` (add to `package.json`)
  - Function `runEdgeInference(modelName: string, input: Float32Array): Promise<Float32Array>`
- [ ] Create `lib/edge/webgpu-runner.ts` (client-side for browser)
  - Feature-detects WebGPU availability, falls back to CPU ONNX
- [ ] Modify `app/api/agents/session/route.ts` — for `entry` and `i18n` agent classes,
  route to `onnx-runner.ts` instead of Anthropic API
- [ ] Add latency benchmark: assert p99 ≤ 200ms for edge inference paths
- [ ] A/B test: 10% traffic to edge inference → compare latency and accuracy vs full model
- [ ] Progressive rollout to 100% once p99 ≤ 200ms and accuracy within 2% of full model
- [ ] Write tests: `__tests__/edge-inference.test.ts` (mock ONNX runtime, assert routing)
- **Effort**: 2–3 weeks | **Defensibility**: Latency moat, offline capability for mobile

---

## Full Checklist Summary

### Tier 1 — REPEAT Loop (Est. 1–2 weeks)
- [ ] 1.1 LoopCycle + PhysiologicalSnapshot DB schema + migration
- [ ] 1.2 `lib/loop/snapshot-materializer.ts` + `lib/loop/pathway-state.ts`
- [ ] 1.3 `lib/loop/loop-trigger.ts` + ingest endpoint wiring
- [ ] 1.4 Loop worker job handlers (observe → plan → act → reflect → complete)
- [ ] 1.5 `app/api/v1/loop/[userId]/route.ts` status API

### Tier 2 — REFLECT Loop (Est. 2–4 weeks)
- [ ] 2.1 ProtocolOutcome schema + `lib/loop/outcome-writer.ts`
- [ ] 2.2 `lib/agents/reflection-agent.ts` + reflect route
- [ ] 2.3 `lib/loop/twin-scorer.ts` + TwinAccuracyScore schema
- [ ] 2.4 `lib/agents/twin-priors.ts` + UserTwinPrior schema + digital-twin-agent.ts update
- [ ] 2.5 Reflection loop trigger + daily cron sweep

### Tier 3 — PLAN as Clinical Reasoning (Est. 2–3 weeks)
- [ ] 3.1 `lib/agents/clinical-planning-agent.ts` + supervisor.ts integration
- [ ] 3.2 Expanded pathway dysregulation classifier + LLM fallback
- [ ] 3.3 `lib/loop/simulation-queue.ts` + digital-twin-agent.ts integration
- [ ] 3.4 Planning quality gate (safety agent always in sequence)

### Tier 4 — Close ACT Loop (Est. 2–3 weeks)
- [ ] 4.1 ProtocolVersion schema + protocol-agent.ts update + versions route
- [ ] 4.2 `lib/loop/cycle-scheduler.ts` + daily cycle sweep cron
- [ ] 4.3 `lib/agents/dosage-optimizer.ts` + dosage route (CLINICIAN gate)
- [ ] 4.4 `lib/reports/cycle-report.ts` + cycle report route

### Tier 5 — Mechanistic Model Calibration (Est. 3–5 weeks)
- [ ] 5.1 UserPkProfile schema + `lib/agents/pk-fitter.ts` + pk-profile route
- [ ] 5.2 Calibrated sidecar connection in `lib/sidecars.ts` + `digital-twin-agent.ts`
- [ ] 5.3 Extended `DigitalTwinRun` prediction storage + `lib/loop/prediction-log-sweeper.ts`
- [ ] 5.4 `lib/agents/model-registry.ts` + model version tracking

### Moats
- [ ] M1 Federated biomarker graph (Substra/NVIDIA FLARE + DP budget)
- [ ] M2 Protocol fork social graph (versioning + leaderboard + outcome propagation)
- [ ] M3 Researcher Cohort Query DSL (parser + executor + IRB tokens + UI)
- [ ] M4 DP budget meter (user-facing privacy meter + notifications)
- [ ] M5 LLM trace-driven distillation (trace miner + shadow router + eval integration)
- [ ] M6 Auto-trial protocol scaffolding (scaffold agent + jurisdiction-aware IRB)
- [ ] M7 Clinician co-sign premium tier (co-sign table + VC integration + license verifier)
- [ ] M8 Edge inference (ONNX export + WebGPU runner + entry/i18n routing)

---

## What Exists Today vs What's New

All items marked `[ ]` above are new builds. For reference:

| Already real (do not rebuild) | File |
|-------------------------------|------|
| Agent supervisor + 15 bio-agents | `lib/agents/supervisor.ts` |
| Digital twin with fallback priors | `lib/agents/digital-twin-agent.ts` |
| Perception + drift + causal agents | `lib/agents/perception-agent.ts` etc. |
| Wearable ingest (Dexcom, webhooks) | `app/api/wearables/` |
| Protocol agent (plateau + adherence) | `lib/agents/protocol-agent.ts` |
| Clinical review queue + safety gates | `app/api/clinician/` |
| AI provider multi-routing + governance | `app/api/ai/` + `lib/ai/governance.ts` |
| W3C VC provenance rail | `lib/provenance/sign-result.ts` |
| Scientist/sponsor marketplace | `scientist-sponsor-marketplace/` |
| 7-stage feedback loop tracker | `lib/loop/feedback-loop.ts` |
| Audit hash chain | `lib/audit.ts` + `lib/audit-integrity.ts` |
| Rate limiting + circuit breaker | `lib/rate-limit.ts` + `lib/circuit-breaker.ts` |
| SCIM SSO + multi-tenancy | `lib/tenancy.ts` + `app/api/scim/` |
| Stripe billing + AI credits | `lib/billing/` + `lib/ai-credits.ts` |
