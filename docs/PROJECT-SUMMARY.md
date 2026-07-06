# Biozephyra — Longevity Research & Information Platform

*An honest one-page summary for venture/incubator and career conversations.*

## What it is
Biozephyra is a web platform that helps people **track their biomarkers** and helps
researchers **find and verify longevity-science evidence and prioritize compounds for
testing**. It is explicitly a **research and information tool — not a medical service.**
Every output is framed as research information, not medical advice, and the
medical-leaning features are gated behind licensed-clinician review by design.

## What's real (built and verified)
- **A production-grade full-stack app** — Next.js 16, TypeScript, PostgreSQL/Prisma.
  It builds cleanly and has **2,000+ automated tests passing** against a real
  database, with CI. It is deployable today.
- **A genuine research engine** — searches PubMed, ClinicalTrials.gov, and PubChem;
  **verifies citations and drops unsupported claims**; ranks candidate compounds for a
  biological target; and runs population queries under **differential privacy +
  k-anonymity** so no individual is exposed.
- **Interactive 3D visualization** — molecular structures, a biomarker-to-organ "3D
  body" that colors organs by the user's own lab values, and a protein–ligand docking
  viewer.
- **A deployable computational-chemistry pipeline** — AutoDock Vina docking and OpenMM
  refinement, containerized and documented, ready to deploy on demand.
- **Safety engineering as a feature** — outputs labeled "not medical advice";
  dose/protocol suggestions are clinician-gated and never auto-applied; an autonomous
  "recommend compounds from a health profile" path is deliberately walled off. These
  rails are **enforced by automated tests** so they can't silently regress.

## What's honest about its limits (this is what makes it credible)
- **Pre-launch.** No users or revenue yet — the immediate goal is the first real users
  of the honest research core.
- **The heavy chemistry engines are built but not yet deployed.** Running them on real
  compute (incl. GPU) is an operations step, not new construction.
- **It produces hypotheses and candidate leads — not validated treatments.** Every
  result still requires laboratory and clinical validation; the platform never claims
  efficacy or "cures."
- **Legal/compliance pages need professional review** before onboarding real users.

## What's next
1. **Deploy the docking/screening pipeline** so candidate ranking runs on real
   computational chemistry (low-cost, CPU-first).
2. **Get the first real users** of the research/biomarker core — researchers and
   health-curious individuals.
3. **Professional legal review** of the disclaimers and compliance posture.
4. **Scientific mentorship** to guide validation and the chemistry roadmap.

## Why it's a strong student venture
It sits in a large, growing market (longevity / healthspan) with a deliberately
**honest, lower-liability positioning** — a research tool, not unlicensed medical
advice. It is technically substantial and already working, with clear, fundable next
steps that map exactly to what a university venture program provides: **mentorship, a
legal clinic, compute funding, and access to first users.**

---
*Engineering demonstrated:* full-stack web (Next.js/React/TypeScript, PostgreSQL/Prisma),
CI & testing (2,000+ tests), cloud/containers (Docker microservices), scientific-computing
integration (RDKit, AutoDock Vina, OpenMM), security & privacy engineering (auth, CSP,
differential privacy), and product/compliance judgment (safety guardrails, honest claims).
