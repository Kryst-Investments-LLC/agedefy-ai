# Bio-Agents Implementation Plan

> **Status:** Planning  
> **Target:** Transform Biozephyra from a stateless AI dashboard into an autonomous multi-agent scientific discovery engine.

---

## Phase 1 — Agent Core Infrastructure (Foundation)

These items unblock every subsequent phase. Build them first.

### 1.1 Agent Runtime Types & Interfaces

- [ ] Create `lib/agents/types.ts` — define `BioAgent`, `AgentClass`, `AgentMessage`, `AgentPlan`, `AgentStep`, `AgentResult` interfaces
- [ ] Define the five agent classes as a union type: `perception | discovery | protocol | safety | explainability`
- [ ] Define `AgentSession` type with persistent state (goal, plan steps, scratchpad, results, status)
- [ ] Wire agent types into the existing AI governance layer (`lib/ai/governance.ts`) so governed-model checks apply to agent invocations

### 1.2 Shared Scratchpad / Message Bus

- [ ] Create `lib/agents/scratchpad.ts` — in-memory shared state store that agents read/write during a session
- [ ] Define `ScratchpadEntry` type: `{ key, value, writtenBy, timestamp, ttlMs? }`
- [ ] Support session-scoped isolation (each user session gets its own scratchpad instance)
- [ ] Add Prisma model `AgentSession` to persist scratchpad snapshots across requests (long-running sessions)

### 1.3 Planning Loop Engine

- [ ] Create `lib/agents/planner.ts` — implements the iterative plan → execute → verify → revise loop
- [ ] Accept a goal string and decompose it into ordered `AgentStep[]` using the configured LLM
- [ ] Each step specifies: target agent class, tool calls, expected output schema, verification criteria
- [ ] Support plan revision: if a step fails verification, the planner can re-plan remaining steps
- [ ] Integrate with `lib/ai/clinical-context.ts` to inject user context into the planning prompt

### 1.4 Prisma Schema Additions

- [ ] Add `AgentSession` model: `id, userId, tenantId, goal, status (planning|running|paused|completed|failed), plan (Json), scratchpad (Json), createdAt, updatedAt, completedAt`
- [ ] Add `AgentStepLog` model: `id, sessionId, stepIndex, agentClass, input (Json), output (Json), status, durationMs, error, createdAt`
- [ ] Add relation to existing `User` model
- [ ] Run `pnpm db:generate` and `pnpm db:push`

---

## Phase 2 — Specialist Agent Classes

Build each agent class as an independent module that plugs into the planner.

### 2.1 Perception Agent (→ Biomarker Tracking)

- [ ] Create `lib/agents/perception-agent.ts`
- [ ] Ingest latest biomarker entries from `lib/ai/clinical-context.ts`
- [ ] Detect deltas, trends, anomalies across biomarker time-series
- [ ] Output a structured "physiological snapshot" to the scratchpad
- [ ] Future: accept wearable data streams (Oura, Whoop, Apple Health) via `lib/wearables/`

### 2.2 Discovery Agent (→ Discovery Lab / ÆonForge)

- [ ] Create `lib/agents/discovery-agent.ts`
- [ ] Wrap the existing `lib/aeonforge/engine.ts` `discoverCandidatesLocal()` as a tool the agent can invoke
- [ ] Add PubMed/PMC search tool via NCBI E-utilities API (neuro-symbolic grounding)
- [ ] Add clinical-trial search tool wrapping `lib/clinical-trials.ts`
- [ ] Implement result cross-referencing: verify candidate mechanisms against retrieved literature
- [ ] Output ranked candidates with evidence grades to scratchpad

### 2.3 Protocol Agent (→ Protocol Engine)

- [ ] Create `lib/agents/protocol-agent.ts`
- [ ] Read active protocols and biomarker deltas from scratchpad
- [ ] Detect plateau patterns (biomarker stagnation over N entries)
- [ ] Suggest stack adjustments: add/remove/swap compounds with reasoning
- [ ] Cross-check suggestions against `lib/safety/interaction-checker.ts`
- [ ] Output protocol adjustment recommendations

### 2.4 Safety / Review Agent (→ Telemedicine)

- [ ] Create `lib/agents/safety-agent.ts`
- [ ] Monitor all agent outputs for contraindication signals
- [ ] Cross-reference against user medications (`clinical-context.medications`)
- [ ] Auto-flag "Review Items" for clinician intervention via the existing governance/review-item system
- [ ] Gate any compound recommendation behind safety-agent approval before surfacing to user
- [ ] Integrate HPO (Human Phenotype Ontology) term matching for condition-aware safety checks

### 2.5 Explainability Agent (→ User Dashboard)

- [ ] Create `lib/agents/explainability-agent.ts`
- [ ] Consume scratchpad outputs from all other agents
- [ ] Translate complex metabolic/molecular findings into plain-language insights
- [ ] Generate user-facing summaries with confidence levels and source citations
- [ ] Respect existing `providerAIResponseSchema` format for consistent UI rendering
- [ ] Support i18n: output in the user's configured locale

---

## Phase 3 — Supervisor Orchestrator

### 3.1 Supervisor Agent

- [ ] Create `lib/agents/supervisor.ts`
- [ ] Accept high-level user goals (e.g., "Analyze my metabolic markers and suggest a stack")
- [ ] Decompose into subtasks routed to the correct specialist agent class
- [ ] Manage task queue ordering and dependencies
- [ ] Enforce medical safety policies: no recommendation surfaces without safety-agent sign-off
- [ ] Track session progress and handle agent failures/retries
- [ ] Respect AI governance: model allowlists, audit logging, credit budgets

### 3.2 API Route

- [ ] Create `app/api/agents/session/route.ts` — POST to start a new agent session, GET to poll status
- [ ] Create `app/api/agents/session/[id]/route.ts` — GET session results, DELETE to cancel
- [ ] Apply existing auth, rate-limit, GDPR consent, and tenant-scoping middleware
- [ ] Wire audit logging for all agent session lifecycle events

### 3.3 Streaming / Real-time Updates

- [ ] Add SSE (Server-Sent Events) endpoint for agent session progress
- [ ] Push step-by-step updates to the frontend as agents complete sub-tasks
- [ ] Allow user to pause/cancel a running agent session

---

## Phase 4 — Neuro-Symbolic Grounding

### 4.1 NCBI Integration

- [ ] Create `lib/agents/tools/ncbi.ts` — typed client for NCBI E-utilities (esearch, efetch, elink)
- [ ] Implement PubMed abstract retrieval with structured citation extraction
- [ ] Implement Gene/Protein lookup for target validation
- [ ] Respect NCBI API rate limits (3 req/s without key, 10 req/s with key)

### 4.2 Human Phenotype Ontology (HPO)

- [ ] Create `lib/agents/tools/hpo.ts` — HPO term lookup and traversal
- [ ] Map user health conditions to HPO terms for precise agent queries
- [ ] Use HPO hierarchy to expand/narrow condition searches

### 4.3 Ontology-Grounded Validation

- [ ] Add validation step in the planning loop: agent outputs must reference valid biological entities
- [ ] Cross-check compound targets against Gene Ontology (GO) biological process terms
- [ ] Flag outputs that rely solely on LLM generation without ontology grounding

---

## Phase 5 — Agent Memory & Learning

### 5.1 Persistent Agent Memory

- [ ] Create `lib/agents/memory.ts` — long-term user-scoped agent memory store
- [ ] Store: previous session summaries, successful protocol adjustments, user preferences
- [ ] Inject relevant memory fragments into agent planning context
- [ ] Respect data retention policies and GDPR right-to-delete

### 5.2 Agent Performance Tracking

- [ ] Track accuracy metrics: did biomarker predictions match subsequent lab results?
- [ ] Track user feedback on agent recommendations (helpful / not helpful)
- [ ] Feed metrics back into agent prompt tuning

---

## Priority Order (Recommended)

| Priority | Items | Rationale |
|----------|-------|-----------|
| **P0** | 1.1, 1.2, 1.3, 1.4 | Foundation — nothing works without the runtime, scratchpad, and planning loop |
| **P1** | 2.4 (Safety Agent) | Must exist before any other agent can surface recommendations to users |
| **P2** | 2.1 (Perception), 2.5 (Explainability) | Highest user-visible impact: real-time biomarker insights on the dashboard |
| **P3** | 2.2 (Discovery), 2.3 (Protocol) | Leverage existing ÆonForge and protocol engine; accelerate scientific discovery |
| **P4** | 3.1, 3.2, 3.3 (Supervisor + API) | Multi-agent orchestration for compound workflows |
| **P5** | 4.1, 4.2, 4.3 (Neuro-symbolic) | Accuracy and hallucination reduction via ontology grounding |
| **P6** | 5.1, 5.2 (Memory + Learning) | Long-term platform intelligence; depends on stable agent system |

---

## Integration Points with Existing Code

| Existing Module | Bio-Agent Integration |
|---|---|
| `lib/ai/governance.ts` | All agent invocations go through governed AI request assertions |
| `lib/ai/clinical-context.ts` | Perception agent and planner inject user clinical context |
| `lib/aeonforge/engine.ts` | Discovery agent wraps as a callable tool |
| `lib/safety/interaction-checker.ts` | Safety agent uses for contraindication checks |
| `lib/clinical-trials.ts` | Discovery agent uses for trial search |
| `lib/services/aeonforge.ts` | Supervisor delegates discovery tasks here |
| `lib/audit.ts` | All agent sessions and steps are audit-logged |
| `lib/ai-credits.ts` | Agent sessions consume AI credits with budget enforcement |
| `lib/admin-orchestration-summary.ts` | Agent jobs integrate into the admin orchestration queue |
| `lib/wearables/` | Perception agent ingests wearable data streams |

---

## Non-Goals (Out of Scope)

- Replacing the existing single-turn AI provider routes — they continue to work for simple queries
- Training or fine-tuning custom models — agents use existing LLM providers
- External agent framework lock-in (no hard dependency on LangChain, AutoGen, etc.)
- Real-time wearable streaming in Phase 1 (deferred to after Perception Agent baseline)
