# Workflow reference

Each workflow is a declarative YAML spec validated against
[`schemas/workflow.schema.json`](../../schemas/workflow.schema.json) and
gated in CI by `.github/workflows/validate-agents.yml`.

| Workflow | Intent | Primary feature module |
|---|---|---|
| [biomarker_interpretation_workflow](../../workflows/biomarker_interpretation_workflow.yml) | `longevity.biomarker_context` | Biomarker tracking |
| [protocol_recommendation_workflow](../../workflows/protocol_recommendation_workflow.yml) | `longevity.protocol_recommendation` | Protocol engine |
| [telemedicine_routing_workflow](../../workflows/telemedicine_routing_workflow.yml) | `telemedicine.consultation_request` | Telemedicine |
| [lab_order_workflow](../../workflows/lab_order_workflow.yml) | `labs.order_panel` | Lab testing |
| [compound_interaction_workflow](../../workflows/compound_interaction_workflow.yml) | `knowledge.compound_interaction` | Compound mixer |
| [knowledge_graph_workflow](../../workflows/knowledge_graph_workflow.yml) | `knowledge.lookup` | Knowledge graph |
| [marketplace_purchase_workflow](../../workflows/marketplace_purchase_workflow.yml) | `marketplace.place_order` | Marketplace |
| [subscription_billing_workflow](../../workflows/subscription_billing_workflow.yml) | `billing.subscription_change` | Stripe billing |
| [community_moderation_workflow](../../workflows/community_moderation_workflow.yml) | `community.post_review` | Community forum |
| [learning_content_workflow](../../workflows/learning_content_workflow.yml) | `content.learning_path` | Learning center |
| [clinical_trial_search_workflow](../../workflows/clinical_trial_search_workflow.yml) | `research.clinical_trial_search` | Clinical trials |
| [research_ingestion_workflow](../../workflows/research_ingestion_workflow.yml) | `research.literature_ingest` | Research hub |
| [ai_personalization_workflow](../../workflows/ai_personalization_workflow.yml) | `ai.personalize` | AI personalization |
| [global_search_workflow](../../workflows/global_search_workflow.yml) | `search.global` | Global search |
| [account_gdpr_workflow](../../workflows/account_gdpr_workflow.yml) | `account.gdpr_request` | Admin GDPR |
| [admin_audit_workflow](../../workflows/admin_audit_workflow.yml) | `admin.audit_query` | Admin audit |
| [i18n_resolution_workflow](../../workflows/i18n_resolution_workflow.yml) | `i18n.resolve_locale` | i18n |

Each YAML defines `preconditions`, `legal_checks`, `audit_events`,
`steps`, and an `sla` block. The
[business-agent](../agents/business-agent.md) holds the canonical
intent → workflow map.
