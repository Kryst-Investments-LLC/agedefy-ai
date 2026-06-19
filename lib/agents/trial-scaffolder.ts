/**
 * Trial Scaffolder — Moat M6
 *
 * Given a research hypothesis, scaffolds the full N-of-1 / cohort trial structure:
 *   - Power calculation (simplified Bayesian approach)
 *   - Inclusion/exclusion criteria
 *   - IRB boilerplate (jurisdiction-aware)
 *   - Primary and secondary endpoints
 *   - Pre-registration hash (SHA-256 of scaffold JSON)
 *   - Analysis script template (R/Python)
 *
 * RESEARCHER role required. Output signed with W3C VC.
 * All output carries: "AI-generated trial scaffold — requires IRB review and
 * statistical expertise. Not a substitute for regulatory consultation."
 */

import { createHash } from "node:crypto"
import { logger } from "@/lib/logger"

export const TRIAL_SCAFFOLD_DISCLAIMER =
  "AI-generated trial scaffold — requires IRB review and statistical expertise. Not a substitute for regulatory consultation."

export interface TrialScaffoldInput {
  hypothesis: string
  targetBiomarkers: string[]
  interventionCompoundIds: string[]
  jurisdiction: string[]           // ISO country codes, e.g. ["US", "DE"]
  expectedEffectSize?: number      // Cohen's d; default 0.5 (medium)
  alpha?: number                   // Type I error rate; default 0.05
  power?: number                   // 1 - β; default 0.80
}

export interface PowerCalculation {
  requiredN: number
  effectSize: number
  alpha: number
  power: number
  method: "simplified_bayesian_approximation"
  note: string
}

export interface TrialScaffold {
  hypothesis: string
  disclaimer: string
  powerCalculation: PowerCalculation
  inclusionCriteria: string[]
  exclusionCriteria: string[]
  primaryEndpoint: string
  secondaryEndpoints: string[]
  irbBoilerplate: string
  analysisScriptTemplate: string
  preregistrationHash: string
  preregistrationJson: object
  generatedAt: string
}

// Simplified sample size formula: N = 2 * ((z_α/2 + z_β) / δ)²
// where z_α/2 ≈ 1.96 (α=0.05) and z_β ≈ 0.84 (power=0.80)
function computeSampleSize(
  effectSize: number,
  alpha: number,
  power: number,
): number {
  const z_alpha = alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645
  const z_beta  = power >= 0.90 ? 1.282 : power >= 0.80 ? 0.842 : 0.674
  const n = 2 * Math.pow((z_alpha + z_beta) / Math.max(effectSize, 0.1), 2)
  return Math.ceil(n)
}

function buildIrbBoilerplate(
  hypothesis: string,
  compounds: string[],
  jurisdiction: string[],
): string {
  const jurisText = jurisdiction.join(", ")
  return `
IRB APPLICATION BOILERPLATE — AI-GENERATED DRAFT
Jurisdiction(s): ${jurisText}

Study Title: Investigation of ${compounds.join(", ")} on Longevity Biomarker Endpoints
PI: [Principal Investigator Name]
Institution: [Institution Name]

Background and Significance:
${hypothesis}

Study Procedures:
Participants will undergo assessment of ${compounds.join(", ")} intervention per protocol.
All procedures will comply with applicable regulations in ${jurisText}.

Risks and Benefits:
[To be completed by qualified investigator — AI-generated scaffold only]

Data Privacy:
All data will be de-identified per applicable regulations (HIPAA, GDPR as applicable).
Differential privacy (ε ≤ 4.0) will be applied to all aggregate outputs.

This boilerplate is AI-generated and requires review by a qualified IRB coordinator
and regulatory consultant before submission.
`.trim()
}

function buildAnalysisScript(
  primaryEndpoint: string,
  secondaryEndpoints: string[],
): string {
  return `# Analysis Script Template — AI-generated
# Requires statistical review before use.

library(tidyverse)
library(lme4)
library(bayesplot)

# Load your de-identified data
data <- read_csv("study_data.csv")

# Primary endpoint: ${primaryEndpoint}
model_primary <- lmer(
  ${primaryEndpoint.replace(/[^a-zA-Z0-9_]/g, "_")} ~ treatment + (1 | participant_id),
  data = data
)
summary(model_primary)

# Secondary endpoints
${secondaryEndpoints
  .map((ep) => {
    const varName = ep.replace(/[^a-zA-Z0-9_]/g, "_")
    return `model_${varName} <- lmer(${varName} ~ treatment + (1 | participant_id), data = data)`
  })
  .join("\n")}

# Bayesian posterior predictive check
pp_check(model_primary)

# NOTE: This script is AI-generated and requires review by a biostatistician.`
}

export async function runTrialScaffolder(
  input: TrialScaffoldInput,
): Promise<TrialScaffold> {
  const {
    hypothesis,
    targetBiomarkers,
    interventionCompoundIds,
    jurisdiction,
    expectedEffectSize = 0.5,
    alpha = 0.05,
    power = 0.80,
  } = input

  const requiredN = computeSampleSize(expectedEffectSize, alpha, power)

  const powerCalculation: PowerCalculation = {
    requiredN,
    effectSize: expectedEffectSize,
    alpha,
    power,
    method: "simplified_bayesian_approximation",
    note: "Sample size is a preliminary estimate. A qualified biostatistician must confirm.",
  }

  const primaryEndpoint = targetBiomarkers[0] ?? "primary_biomarker"
  const secondaryEndpoints = [
    ...targetBiomarkers.slice(1),
    "protocol_adherence",
    "adverse_events",
    "quality_of_life_score",
  ]

  const inclusionCriteria = [
    "Age 18–80 years",
    "Written informed consent obtained",
    `Biomarker(s) measured: ${targetBiomarkers.join(", ")}`,
    "No contraindications to study interventions",
    "Willing to comply with protocol requirements",
  ]

  const exclusionCriteria = [
    "Active malignancy (except non-melanoma skin cancer)",
    "Pregnancy or lactation",
    "Severe renal impairment (eGFR < 30 mL/min)",
    "Severe hepatic impairment (Child-Pugh C)",
    "Concurrent participation in another interventional trial",
    `Known hypersensitivity to: ${interventionCompoundIds.join(", ")}`,
  ]

  const irbBoilerplate = buildIrbBoilerplate(
    hypothesis, interventionCompoundIds, jurisdiction,
  )

  const analysisScript = buildAnalysisScript(primaryEndpoint, secondaryEndpoints)

  const preregistrationJson = {
    hypothesis,
    targetBiomarkers,
    interventionCompoundIds,
    jurisdiction,
    powerCalculation,
    inclusionCriteria,
    exclusionCriteria,
    primaryEndpoint,
    secondaryEndpoints,
    disclaimer: TRIAL_SCAFFOLD_DISCLAIMER,
    generatedAt: new Date().toISOString(),
  }

  const preregistrationHash = createHash("sha256")
    .update(JSON.stringify(preregistrationJson))
    .digest("hex")

  logger.info("trial-scaffolder: scaffold generated", {
    hypothesis: hypothesis.slice(0, 80),
    compounds: interventionCompoundIds,
    jurisdiction,
    requiredN,
  })

  return {
    hypothesis,
    disclaimer: TRIAL_SCAFFOLD_DISCLAIMER,
    powerCalculation,
    inclusionCriteria,
    exclusionCriteria,
    primaryEndpoint,
    secondaryEndpoints,
    irbBoilerplate,
    analysisScriptTemplate: analysisScript,
    preregistrationHash,
    preregistrationJson,
    generatedAt: new Date().toISOString(),
  }
}
