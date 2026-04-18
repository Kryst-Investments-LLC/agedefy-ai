# AI Integration Guide for Biozephyra AI

This guide documents the real provider-backed AI layer implemented in this repository. It covers the live provider routes, the required production/staging environment shape, and the audit command used to validate production-readiness expectations for the AI surface.

## Overview

The current AI stack is wired through these files:

- `lib/config/ai-config.ts`
- `lib/services/ai-service.ts`
- `app/api/ai/openai/route.ts`
- `app/api/ai/grok/route.ts`
- `app/api/ai/anthropic/route.ts`
- `app/api/ai/aeonforge/route.ts`
- `lib/services/aeonforge.ts`

The central config exposes feature flags for:

- `aiHealthCoach`
- `researchAssistant`
- `virtualAdvisor`
- `predictiveAnalytics`
- `realTimeData`
- `dynamicRecommendations`

The provider-backed routes are protected with rate limiting and include request-context logging, governance hooks, and idempotent mutation handling.

## Required Environment Profile

Production or staging readiness now requires a real provider-backed AI profile. The committed template is aligned to that shape.

```bash
NEXT_PUBLIC_ENABLE_AI_FEATURES="true"
NEXT_PUBLIC_ENABLE_CHATGPT="true"
NEXT_PUBLIC_ENABLE_GROK="false"
NEXT_PUBLIC_ENABLE_ANTHROPIC="false"
NEXT_PUBLIC_USE_MOCK_DATA="false"
NEXT_PUBLIC_DEBUG_MODE="false"
OPENAI_API_KEY=""
```

Rules enforced by the audit:

- `NEXT_PUBLIC_USE_MOCK_DATA` must be explicitly `false` for a real readiness pass.
- `NEXT_PUBLIC_DEBUG_MODE` must be `false`.
- `NEXT_PUBLIC_ENABLE_AI_FEATURES` must be `true`.
- At least one provider flag must be enabled.
- Any enabled provider must have a real API key configured.

## Environment Variables

The AI-related variables currently expected by the repo are:

```bash
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GROK_API_KEY=""

NEXT_PUBLIC_ENABLE_AI_FEATURES="true"
NEXT_PUBLIC_ENABLE_CHATGPT="true"
NEXT_PUBLIC_ENABLE_GROK="false"
NEXT_PUBLIC_ENABLE_ANTHROPIC="false"

NEXT_PUBLIC_ENABLE_PUBMED_API="false"
NEXT_PUBLIC_ENABLE_CLINICAL_TRIALS_API="false"
NEXT_PUBLIC_ENABLE_BIOMARKER_API="false"
NEXT_PUBLIC_ENABLE_REAL_TIME_DATA="false"
NEXT_PUBLIC_ENABLE_LIVE_ANALYTICS="false"
NEXT_PUBLIC_ENABLE_DYNAMIC_RECOMMENDATIONS="false"

NEXT_PUBLIC_USE_MOCK_DATA="false"
NEXT_PUBLIC_DEBUG_MODE="false"
```

AeonForge uses a separate server-side configuration surface:

```bash
AEONFORGE_API_ENDPOINT=""
AEONFORGE_API_KEY=""
AEONFORGE_TIMEOUT_MS="300000"
AEONFORGE_MAX_RETRIES="2"
```

Populate all blank credential values from your deployment secret store before calling live providers or running the readiness audit.

## Implemented Provider Routes

### OpenAI

- Route: `POST /api/ai/openai`
- Enable flag: `NEXT_PUBLIC_ENABLE_CHATGPT`
- API key: `OPENAI_API_KEY`
- Current model in config: `gpt-4-turbo-preview`

### Grok

- Route: `POST /api/ai/grok`
- Enable flag: `NEXT_PUBLIC_ENABLE_GROK`
- API key: `GROK_API_KEY`
- Current model in config: `grok-beta`

### Anthropic

- Route: `POST /api/ai/anthropic`
- Enable flag: `NEXT_PUBLIC_ENABLE_ANTHROPIC`
- API key: `ANTHROPIC_API_KEY`
- Current model in config: `claude-3-sonnet-20240229`

### AeonForge smart router

- Route: `POST /api/ai/aeonforge`
- Service client: `lib/services/aeonforge.ts`
- Server env: `AEONFORGE_API_ENDPOINT`, `AEONFORGE_API_KEY`

AeonForge is not part of the `lib/config/ai-config.ts` provider map. It is a separate server-side integration used for escalation into pharmaceutical discovery workflows.

## Central Service Usage

Client-facing AI calls are routed through `lib/services/ai-service.ts`.

```typescript
import { aiService } from '@/lib/services/ai-service'

const recommendation = await aiService.getHealthRecommendation({
  age: 35,
  biomarkers: { glucose: 95, hba1c: 5.2 },
  lifestyle: { exercise: 'moderate', sleep: 7 },
})

const research = await aiService.researchQuery({
  query: 'What are the latest findings on NAD+ precursors for longevity?',
  maxResults: 3,
})

const advice = await aiService.getVirtualAdvisorResponse(
  'Should I start taking metformin for longevity?',
  '40 year old user with prediabetes history'
)
```

Provider selection is fallback-based:

1. OpenAI
2. Grok
3. Anthropic

If no provider is enabled, the service throws an error.

## AI Readiness Audit

The repository includes a scripted AI audit:

```bash
pnpm audit:ai
```

The audit currently checks:

- required AI structure and config files
- `.env.local` explicit AI flags
- valid AI env operating profile
- provider key consistency for enabled providers
- AI config wiring in `lib/config/ai-config.ts`
- core AI service methods in `lib/services/ai-service.ts`
- static security/config patterns
- rate limiting references under `app/api/ai`
- observability and logging hooks around the AI layer
- quality gates via `pnpm typecheck`, `pnpm lint`, and `pnpm test`

The audit only treats a provider-backed profile as readiness-capable:

- `provider-production` is the only passing readiness profile
- `mock-development` is now reported as a failure state for readiness artifacts
- missing or blank provider credentials will fail the environment checks

The command writes a markdown report to:

```text
biozephyra-level4-report.md
```

## Local Verification Commands

Use these commands when changing AI-related code or env wiring:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit:ai
```

## Operational Notes

- Do not enable a provider flag without also setting the corresponding server-side API key.
- Do not rely on debug mode for readiness validation; the audit expects `NEXT_PUBLIC_DEBUG_MODE="false"`.
- AI routes are expected to remain rate-limited and observable.
- AeonForge configuration is server-only and should not be exposed through client-side env variables.

## Troubleshooting

### Audit fails on environment validation

Check that `.env.local` is internally consistent:

- provider-backed mode: AI enabled, mock data disabled, at least one provider enabled, enabled provider keys populated
- if the audit reports `mock-development`, switch the flags to live-provider mode before regenerating the report

### Provider route returns `400`

Most often the provider is disabled or the payload is invalid.

### Provider route returns `500`

Most often the required API key is missing or the upstream provider is unavailable.

### AeonForge returns `503`

Check `AEONFORGE_API_ENDPOINT` and `AEONFORGE_API_KEY`.

### Tests start returning `409`

For mutation-style route tests, check idempotency-key generation. This repo now depends on route-level idempotency behavior in several AI and integration paths.

---

**Readiness standard**: do not merge or publish AI-readiness artifacts generated from mock-only configuration.