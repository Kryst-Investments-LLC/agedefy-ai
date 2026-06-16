export interface LabResultInput {
  value: number
  unit: string
  operator: string    // "=" | "<" | ">"
  flag: string | null // "active" | "inactive" | "borderline" | "toxic" | null
  assayType: string | null // "biochemical" | "cellular" | "animal" | "in_silico"
}

export interface FeedbackScores {
  feedbackScore: number
  uncertaintyScore: number
  activityScore: number
  selectivityScore: number
  toxicityScore: number
  nResults: number
  rationale: string
}

export interface FedBackCandidate {
  feedbackScore: number
  screenJson: Record<string, unknown> | null
}

export interface AcquisitionScores {
  acquisitionScore: number
  exploitationScore: number
  explorationScore: number
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

export function computeFeedbackScores(results: LabResultInput[]): FeedbackScores {
  const n = results.length
  if (n === 0) {
    return {
      feedbackScore: 0,
      uncertaintyScore: 1,
      activityScore: 0,
      selectivityScore: 0,
      toxicityScore: 0,
      nResults: 0,
      rationale: "No lab results available.",
    }
  }

  const actives = results.filter((r) => r.flag === "active").length
  const borderlines = results.filter((r) => r.flag === "borderline").length
  const activityScore = clamp((actives + 0.5 * borderlines) / n)

  const confirmedActives = results.filter((r) => r.flag === "active" && r.operator === "=")
  const targetSpecific = confirmedActives.filter(
    (r) => r.assayType === "biochemical" || r.assayType === "cellular",
  )
  const selectivityScore =
    confirmedActives.length > 0
      ? clamp(targetSpecific.length / confirmedActives.length)
      : clamp(activityScore * 0.5)

  const toxics = results.filter((r) => r.flag === "toxic").length
  const toxicityScore = clamp(1 - toxics / n)

  const lodFraction = results.filter((r) => r.operator === ">" || r.operator === "<").length / n
  const unflaggedFraction = results.filter((r) => r.flag === null).length / n
  const resultCountFactor = 1 - Math.min(n, 10) / 10
  const uncertaintyScore = clamp(0.4 * resultCountFactor + 0.4 * lodFraction + 0.2 * unflaggedFraction)

  const feedbackScore = clamp(0.6 * activityScore + 0.2 * selectivityScore + 0.2 * toxicityScore)

  const rationale =
    `${n} results: activity ${pct(activityScore)}, selectivity ${pct(selectivityScore)}, ` +
    `toxicity-safe ${pct(toxicityScore)}, uncertainty ${pct(uncertaintyScore)}.`

  return {
    feedbackScore,
    uncertaintyScore,
    activityScore,
    selectivityScore,
    toxicityScore,
    nResults: n,
    rationale,
  }
}

const DESCRIPTOR_KEYS = ["qed", "mol_log_p", "molecular_weight"] as const

function quartileBin(value: number, sorted: number[]): number {
  if (sorted.length === 0) return -1
  const rank = sorted.filter((v) => v <= value).length
  return Math.min(3, Math.floor((rank / sorted.length) * 4))
}

function descriptorBinKey(
  screenJson: Record<string, unknown> | null,
  refValues: Record<string, number[]>,
): string {
  return DESCRIPTOR_KEYS.map((k) => {
    const val = screenJson?.[k]
    return typeof val === "number" ? quartileBin(val, refValues[k]) : -1
  }).join(",")
}

function buildRefValues(candidates: FedBackCandidate[]): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const k of DESCRIPTOR_KEYS) {
    out[k] = candidates
      .map((c) => c.screenJson?.[k])
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b)
  }
  return out
}

export function computeAcquisitionScore(
  candidateScreenJson: Record<string, unknown> | null,
  fedBackCandidates: FedBackCandidate[],
): AcquisitionScores {
  if (fedBackCandidates.length === 0) {
    return { acquisitionScore: 0.5, exploitationScore: 0.5, explorationScore: 0.5 }
  }

  const refValues = buildRefValues(fedBackCandidates)
  const sorted = [...fedBackCandidates].sort((a, b) => b.feedbackScore - a.feedbackScore)
  const top25 = sorted.slice(0, Math.max(1, Math.ceil(fedBackCandidates.length * 0.25)))

  const candidateBin = descriptorBinKey(candidateScreenJson, refValues)
  const top25Bins = new Set(top25.map((c) => descriptorBinKey(c.screenJson, refValues)))
  const exploitationScore = top25Bins.has(candidateBin) ? 1.0 : 0.0

  const allBins = fedBackCandidates.map((c) => descriptorBinKey(c.screenJson, refValues))
  const binCount = allBins.filter((b) => b === candidateBin).length
  const explorationScore = clamp(1 / (1 + binCount))

  const acquisitionScore = clamp(0.6 * exploitationScore + 0.4 * explorationScore)

  return { acquisitionScore, exploitationScore, explorationScore }
}
