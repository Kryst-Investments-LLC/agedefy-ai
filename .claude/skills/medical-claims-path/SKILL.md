---
name: medical-claims-path
description: Rules for anything touching health-facing content or science in agedefy - coaching outputs, compound knowledge graph, agent endpoints, marketplace copy, biomarker interpretation. Invoke BEFORE writing or editing any user-visible health/science content or the code that generates it.
---

# Medical-claims path (agedefy / Biozephyra)

This platform is longevity **research & care** — informational, never medical.
Wrong language here isn't a style bug; it's legal/regulatory exposure.

## Hard language rules (any user-visible output or template that generates it)
1. NEVER present anything as "cure", "treatment", "therapy", or a "dose"
   recommendation. Outputs are CANDIDATES / LEADS / HYPOTHESES and carry a
   validation disclaimer.
2. No diagnosis framing: biomarker displays describe values and reference
   ranges; they do not tell the user what condition they have.
3. Compound/knowledge-graph content states evidence level (in-vitro / animal
   / human trial / meta-analysis) — a claim without its evidence tier is
   incomplete, not shippable.
4. Marketplace and coaching copy gets the same scrutiny as code: a template
   edit that adds claim-like language fails this path.

## Access + privacy invariants (code-level)
- New agent endpoints: RESEARCHER / CLINICIAN role-gated, never
  consumer-exposed. `lib/agents/discovery-agent.ts` stays forbidden.
- Cohort-level queries keep k-anonymity (≥50) + differential privacy.

## When to run /research (do not answer these from memory)
Trigger the global `/research` skill BEFORE committing to a direction on:
- Any scientific claim you're about to encode (compound effects,
  interactions, biomarker interpretation thresholds)
- Regulatory boundaries (what makes content "medical advice" in a target
  jurisdiction; supplement marketing rules; telemedicine/lab constraints)
- Legal-jurisdiction rules feeding the jurisdiction tooling
Research output must cite sources; unsourced claims don't go in the
knowledge graph or user-facing copy.

## Procedure
1. Identify every user-visible string / generated output your change touches.
2. Apply the language rules; add evidence tiers where missing.
3. Uncertain science or regulation → `/research` first, cite in the PR/commit.
4. Verify role gating on any new/changed endpoint (verify-agedefy Stage 3
   exercises it).
5. In your report, quote the exact user-facing language you added or changed
   so a human can review the claims directly.
