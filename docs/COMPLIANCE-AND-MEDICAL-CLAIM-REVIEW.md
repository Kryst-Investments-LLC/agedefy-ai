# Compliance And Medical-Claim Review

## Scope And Limitation

This is an engineering review of compliance-sensitive claim surfaces in the repository. It is not legal advice and it is not a medical-regulatory sign-off.

The mode instructions referenced a private legal guidance path under `.github-private/agents/Biozephyra/...`, but that path is not present in this workspace. As a result, this review uses only repository evidence and should be treated as conservative.

This document captures the original findings from the review pass. Some first-pass hardening has since landed, especially around provider AI response metadata and the strongest launch-facing copy, but the underlying compliance rationale still applies.

## Findings

### 1. Marketing metadata overstates safety and market position

At the time of review, `app/layout.tsx` described the product as:

- "The world's most comprehensive anti-aging research platform"
- "Discover safe anti-aging solutions"

Those are strong external claims. The verification pass found substantial implementation, but not evidence sufficient to support absolute market-position language or broad safety claims.

Risk: high for overclaiming.

### 2. Provider AI routes return recommendation text without mandatory citation/disclaimer payloads

At the time of review, the main provider routes in `app/api/ai/openai/route.ts`, `app/api/ai/anthropic/route.ts`, and `app/api/ai/grok/route.ts` returned free-form model content plus provider/model/usage fields.

That gap has now received a first-pass fix: the provider routes return mandatory disclaimer fields and a citations array through a shared response envelope. The remaining risk is broader policy coverage, uncertainty modeling, and consistent rollout beyond the governed provider slice.

Risk: high for any product messaging that implies clinically reliable or decision-support-grade output.

### 3. The repo contains good disclaimer language, but it is not uniformly attached to every sensitive surface

Positive controls do exist:

- `app/disclaimer/page.tsx` clearly says the platform is educational/research-oriented and not medical advice
- `app/learn/[slug]/page.tsx` includes educational-use disclaimer text
- AeonForge routes propagate disclaimer payloads when the upstream service returns them

The gap is consistency. The generic provider AI routes do not force disclaimer/citation blocks in their returned payloads.

Risk: medium to high depending on UI presentation.

### 4. Telemedicine credential claims are stronger than the verified repo evidence

At the time of review, `app/telemedicine/page.tsx` said users could connect with board-certified physicians specializing in longevity medicine and evidence-based anti-aging protocols.

The verification pass confirmed provider-directory and consultation workflows in code, but it did not verify a credential-source-of-truth or external credential-validation flow.

Risk: medium to high for jurisdiction-specific telemedicine compliance and marketing substantiation.

### 5. Learning Center review claims need workflow substantiation

At the time of review, `app/learn/page.tsx` said every piece is backed by published research and reviewed before publication.

The repo has article surfaces and some review infrastructure, but this pass did not verify a hard publication gate proving every article satisfies that standard.

Risk: medium for editorial overstatement.

### 6. Discovery/AeonForge language is highly compliance-sensitive

The README and AeonForge routes use terms such as pharmaceutical superintelligence, molecular discovery, digital twins, and predicted healthspan gain.

The repo does include disclaimer language and tier gating, which is good. But these remain high-sensitivity claims that should not be marketed as clinically validated capabilities without specialized review.

Risk: high.

### 7. Governance and privacy controls are real, but they do not equal legal readiness by themselves

Verified positive controls include:

- consent mutation flow in `app/api/account/consent/route.ts`
- user export and delete flows in `app/api/account/export/route.ts` and `app/api/account/delete/route.ts`
- review-item and audit-log surfaces in `app/api/admin/review-items/route.ts` and `app/api/admin/audit-logs/route.ts`
- evidence provenance/review metadata in intelligence and clinical-trial ingest surfaces

These are important, but they do not replace legal review, medical-regulatory analysis, or jurisdiction-specific telemedicine/supplement/commercial policy work.

Risk: low as controls, high if treated as a substitute for legal sign-off.

## What The Team Can Say Safely Today

The most defensible current positioning is along these lines:

- Biozephyra is an educational and research-oriented longevity platform with biomarker, protocol, research, marketplace, telemedicine, and governance modules.
- The repository contains real code, real persistence, and a passing automated validation baseline.
- OpenAI, ClinicalTrials.gov, and PubMed were live-verified in this environment during the current pass.
- Other integrations such as Anthropic, Grok, AeonForge, Stripe, SMTP, Kafka, and Pub/Sub are implemented but were not all live-supported in the current environment.

## What The Team Should Not Say Yet

Without additional compliance work, avoid strong public statements such as:

- that the platform provides medical advice, diagnosis, or treatment
- that AI outputs are clinically authoritative or uniformly evidence-backed at response time
- that the product offers safe anti-aging solutions in a substantiated regulatory sense
- that every telemedicine provider claim is externally verified by compliance controls proven in repo
- that the whole platform is enterprise Level 4 ready
- that all third-party integrations are live and production-proven

## Recommended Pre-Launch Compliance Work

1. Continue reducing or qualifying the remaining marketing claims around safety, comprehensiveness, and anti-aging efficacy.
2. Extend the new provider-AI disclaimer and citation contract to any remaining AI surfaces and add stronger uncertainty handling.
3. Add high-risk query classification and human-review escalation for medical-adjacent AI usage.
4. Produce explicit credential-verification and jurisdiction-handling policies for telemedicine claims.
5. Add hard workflow checks for reviewed/approved scientific content before making global editorial guarantees.
6. Route AeonForge, drug-discovery, and healthspan-improvement language through legal and scientific review before strong public readiness statements.

## Bottom Line

The repository already contains several good compliance-oriented building blocks, but the current evidence supports a careful educational/research-platform story, not an aggressive medical-readiness or regulatory-readiness story.