# Lab & Wearable Provider Adapters

One YAML file per external provider that supplies biomarker data to the
AgeDefy platform. Each adapter declares:

- `provider_id` — slug used by ingestion pipeline
- `kind` — `lab` | `wearable` | `genomics`
- `modality` — matches `metadata/biomarkers.yml.modality`
- `auth` — OAuth2 / API key / file upload (VCF, CSV, FIT)
- `webhook` — push channel (if real-time)
- `polling` — pull schedule (if batch)
- `fhir_r5_mapping` — per-biomarker mapping to FHIR R5 `Observation`
  resources (LOINC codes when available, custom codes under
  `http://agedefy.ai/fhir/CodeSystem/longevity` otherwise)
- `privacy_class` — drives encryption-at-rest tier and on-device-only flag
- `consent_scope` — strings shown to user in the consent UI
- `legal_jurisdictions_blocked` — providers we cannot ingest from in
  certain jurisdictions (e.g. EU residency rules)

## Ingestion pipeline

```
provider webhook / poll
        │
        ▼
adapter.normalize(payload)  →  FHIR R5 Bundle
        │
        ▼
outbox.publish("biomarker.ingested", bundle)
        │
        ▼
worker → Postgres + cohort store
        │
        ▼
trigger: rolling-delta-watcher → causal-inference-agent re-eval
```

See `tools-v3/` for adapter code generators (`new-lab-provider.ps1`).
