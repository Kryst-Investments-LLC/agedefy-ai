# External Integration Verification

## Scope

This document evaluates the external integrations that the README claims or implies are supported.

Evidence sources used in this pass:

- local environment inspection without exposing secret values
- `pnpm typecheck`
- `pnpm test`
- live HTTP smoke requests against a local Next.js server on 2026-04-01

## Local Environment Availability

Local environment status at verification time:

- `OPENAI_API_KEY`: set
- `ANTHROPIC_API_KEY`: missing
- `GROK_API_KEY`: missing
- `AEONFORGE_API_ENDPOINT`: missing
- `AEONFORGE_API_KEY`: missing
- `STRIPE_SECRET_KEY`: empty
- `STRIPE_WEBHOOK_SECRET`: empty
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`: missing
- `OUTBOX_BROKER`: missing
- `KAFKA_BROKERS`: missing
- `PUBSUB_PROJECT_ID`: missing

That means the current machine can only meaningfully live-validate:

- OpenAI, after correcting the stale default model pin found during this verification
- ClinicalTrials.gov
- PubMed / NCBI E-utilities

## Results

| Integration | Representative implementation | Representative automated evidence | 2026-04-01 live result | Verdict |
| --- | --- | --- | --- | --- |
| OpenAI | `lib/config/ai-config.ts`, `app/api/ai/openai/route.ts` | `__tests__/ai-provider-orchestration-routes.test.ts` | Initially failed with upstream `404 model_not_found` because the repo was pinned to `gpt-4-turbo-preview`. The default model was updated during this pass to `gpt-4o-mini`, and `POST /api/ai/openai` then returned `200` with `provider=OpenAI`, `model=gpt-4o-mini`, `content=VERIFIED`. | Live-verified after fixing a real configuration defect discovered by the smoke test. |
| Anthropic | `app/api/ai/anthropic/route.ts` | `__tests__/ai-provider-orchestration-routes.test.ts` | `POST /api/ai/anthropic` returned `400` with `Anthropic is not enabled`. No key is configured locally. | Implemented, but not active in the current environment. |
| Grok | `app/api/ai/grok/route.ts` | `__tests__/ai-provider-orchestration-routes.test.ts` | `POST /api/ai/grok` returned `400` with `Grok is not enabled`. The route also still contains placeholder comments around endpoint/pricing assumptions. | Implemented, but not active locally and not mature enough to treat as strongly verified provider support. |
| AeonForge smart router | `app/api/ai/aeonforge/route.ts`, `lib/services/aeonforge.ts` | `__tests__/aeonforge-smart-router.test.ts` | Local env is missing the endpoint and key, so the smart-router integration is not verifiable end-to-end against the external service. | Code-and-tests only in the current environment. |
| AeonForge discovery endpoint | `app/api/aeonforge/prompt/route.ts`, `app/api/aeonforge/candidates/route.ts`, `app/api/aeonforge/candidates/[id]/route.ts` | `__tests__/aeonforge-route.test.ts` | `POST /api/aeonforge/prompt` returned `503` with `AeonForge service not available` because the upstream service is not configured locally. | Implemented, but not live-supported in the current environment. |
| ClinicalTrials.gov | `lib/clinical-trials.ts`, `app/api/clinical-trials/search/route.ts`, `app/api/research/clinical-trials/route.ts` | Indirect coverage through research and intelligence tests; no dedicated route suite was found | `GET /api/clinical-trials/search?q=rapamycin%20aging&limit=3` returned `200` with `count=3`. `POST /api/research/clinical-trials` returned `200` with `entryCount=3` and `evidenceCreated=3`. | Live-verified. |
| PubMed / NCBI E-utilities | `lib/research.ts`, `app/api/research/ingest/route.ts` | `__tests__/research-ingest-orchestration-route.test.ts` | `POST /api/research/ingest` returned `202` with `entryCount=2` and an orchestration job id, proving live upstream fetch plus local persistence/queue handoff. | Live-verified. |
| Stripe | `lib/stripe.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/portal/route.ts`, `app/api/stripe/webhook/route.ts` | `__tests__/stripe-webhook-marketplace.test.ts`, `__tests__/marketplace-payment-confirm-route.test.ts` | `POST /api/stripe/checkout` returned `500` with `Stripe is not configured`. | Implemented, but not live-supported in the current environment. |
| SMTP / Nodemailer | `lib/services/email-service.ts`, auth email routes | `__tests__/email-tokens.test.ts`, `__tests__/validators-email-lab.test.ts` | Registration and forgot-password flows succeeded locally, but the server logged email previews instead of using SMTP because SMTP is not configured. | Implemented with a development preview fallback; not live-verified against a real SMTP provider. |
| Kafka | `lib/events/broker-runtime.ts`, `scripts/outbox-dispatch.ts`, `scripts/outbox-worker.ts`, `scripts/outbox-smoke.ts`, `k8s/minikube-kafka.yaml` | `__tests__/outbox-dispatcher.test.ts`, `__tests__/health-event-publisher.test.ts` | No local broker credentials or brokers were configured. The README itself already notes that live dispatch still needs real broker values. | Infrastructure exists, but no live local validation was possible. |
| Google Pub/Sub | `lib/events/broker-runtime.ts`, outbox scripts, k8s/Helm manifests | No dedicated Pub/Sub live tests found in this pass | No local `PUBSUB_PROJECT_ID` or credentials were configured. | Infrastructure exists, but no live local validation was possible. |

## Important Observations

### OpenAI was a real readiness bug, not a paperwork issue

The first smoke run proved that the repository's default OpenAI model pin was stale. The route returned a real upstream error because `gpt-4-turbo-preview` was no longer valid for the configured account.

This was corrected during the verification pass by switching the default model to `gpt-4o-mini`, after which the live route returned `200`.

### The provider matrix is still not honestly "multi-provider live ready"

The README can truthfully say that the codebase has provider routes for OpenAI, Anthropic, and Grok.

It cannot honestly say that all three are live-supported in the current environment:

- OpenAI: live-verified
- Anthropic: disabled and unconfigured
- Grok: disabled, unconfigured, and still marked with placeholder implementation notes

### SMTP behaves as a preview system locally

`lib/services/email-service.ts` intentionally falls back to logging email previews in non-production when SMTP is missing.

That is a good developer experience, but it means local success of registration/reset flows is not the same thing as live email delivery verification.

### Kafka and Pub/Sub remain documentation-backed, not env-backed

The outbox, scripts, k8s manifests, and smoke tooling are real.

What is missing on this machine is the runtime credential layer required to treat those integrations as live-validated.

## Bottom Line

The currently honest integration statement is:

- live-verified now: OpenAI, ClinicalTrials.gov, PubMed
- implemented but not locally active: Anthropic, Grok, AeonForge, Stripe, SMTP
- infrastructure present but not locally live-validated: Kafka, Google Pub/Sub

Anything stronger than that would overstate the evidence collected in this repository and this environment.