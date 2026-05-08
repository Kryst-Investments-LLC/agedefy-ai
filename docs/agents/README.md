# Agent reference

Generated table of contents. Each page describes the agent's role,
contract, dependencies, SLAs, error handling, and example traces.

| Agent | Role |
|---|---|
| [entry-agent](entry-agent.md) | NLU front door — parse query, extract slots, classify intent. |
| [master-orchestrator-agent](master-orchestrator-agent.md) | Dispatches intents to primary + sub-agents; enforces SLAs. |
| [domain-agent](domain-agent.md) | Longevity-medicine expert reasoning (compounds, pathways, biomarkers). |
| [business-agent](business-agent.md) | Maps intents to workflows; orchestrates business operations. |
| [law-awareness-agent](law-awareness-agent.md) | Applies jurisdictional legal rules; allow / warn / block / redact. |
| [safety-agent](safety-agent.md) | Clinical safety and red-team filters; blocks dangerous outputs. |
| [clinician-review-agent](clinician-review-agent.md) | Routes high-risk content to a licensed clinician queue. |
| [ai-personalization-agent](ai-personalization-agent.md) | Personalises tone, depth, and recommendations to user profile. |
| [telemedicine-agent](telemedicine-agent.md) | Provider-licensure-aware telehealth routing. |
| [marketplace-agent](marketplace-agent.md) | Catalog, eligibility, gating, fulfillment hand-off. |
| [billing-agent](billing-agent.md) | Stripe customer/subscription/usage/invoice flows. |
| [community-moderation-agent](community-moderation-agent.md) | Forum CSAM/PHI/misinformation moderation. |
| [research-agent](research-agent.md) | Clinical-trial + literature ingestion and summarisation. |
| [knowledge-graph-agent](knowledge-graph-agent.md) | Ontology over compounds × pathways × biomarkers × outcomes. |
| [observability-agent](observability-agent.md) | Trace + metric + alert emission. |
| [audit-governance-agent](audit-governance-agent.md) | Immutable audit log; GDPR/CCPA/DPDP request handling. |
| [i18n-agent](i18n-agent.md) | Locale resolution, translation fallback, jurisdiction-aware copy. |
| [ux-ui-agent](ux-ui-agent.md) | UX/UI heuristics; accessibility checks. |
| [design-system-agent](design-system-agent.md) | Design-token + component compliance. |
| [brand-consistency-agent](brand-consistency-agent.md) | Voice, terminology, brand-guidelines linting. |
