/**
 * digital-twin-pdf — renders a `DigitalTwinForecastReceipt` Verifiable
 * Credential to a single-page PDF suitable for a clinician or patient wallet.
 *
 * Implemented as a zero-dependency PDF 1.4 writer so the platform doesn't have
 * to take on a heavy PDF runtime just to print a structured receipt. Uses only
 * the 14 built-in PDF core fonts (Helvetica + Helvetica-Bold) so no font
 * embedding is required. The renderer is intentionally conservative: ASCII
 * text only, with non-ASCII collapsed to "?" — clinical receipts are not the
 * place to wrestle with arbitrary glyph coverage.
 *
 * Display tier policy:
 *   - `illustrative`        → red banner "ILLUSTRATIVE — NOT CLINICAL GUIDANCE"
 *   - `calibrated-partial`  → amber banner "CALIBRATED (partial) — clinician review required"
 *   - `calibrated`          → no banner
 */

import type { VerifiableCredential, MechanisticBackendUsed } from "@/lib/sidecars"
import {
  synthesiseDisplayPolicy,
  type TwinDisplayPolicy,
} from "@/lib/agents/twin-display-policy"

export interface DigitalTwinPdfInput {
  vc: VerifiableCredential
  /**
   * Display-tier policy. Optional — when omitted, derived from the VC
   * payload's embedded `display_tier` / `low_confidence_outcomes` /
   * `backend_used` fields (added in PR #24).
   */
  policy?: TwinDisplayPolicy
  /** Optional clinician/patient name to print as the recipient line. */
  recipient?: string
  /** Optional ISO date string overriding `new Date().toISOString()`. */
  generatedAt?: string
}

interface OutcomeSummary {
  outcome: string
  baseline: number | null
  final_week_mean: number
  total_delta: number
  total_delta_pct: number | null
  ci95_final: [number, number]
  low_confidence_flag: boolean
}

interface InterventionRow {
  intervention_id: string
  dose?: string | number
  schedule?: string
  start_week?: number
  stop_week?: number | null
}

interface ReceiptPayload {
  simulation_id?: string
  backend_used?: string
  model_version?: string
  horizon_weeks?: number
  fallback_used?: boolean
  display_tier?: TwinDisplayPolicy["tier"]
  is_illustrative?: boolean
  requires_clinician_banner?: boolean
  low_confidence_outcomes?: string[]
  interventions?: InterventionRow[]
  outcome_summaries?: OutcomeSummary[]
  warnings?: string[]
  pkpd_profile?: "1-cmt" | "2-cmt"
}

function asciiOnly(value: string): string {
  // PDF text strings in this writer are emitted as literal strings using
  // (...) syntax, so backslashes and parentheses must be escaped. We also
  // strip non-printable / non-ASCII to keep the file small and font-safe.
  let out = ""
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    let ch = value[i]
    if (code < 0x20 || code > 0x7e) {
      ch = "?"
    }
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += "\\" + ch
    } else {
      out += ch
    }
  }
  return out
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—".replace("—", "-")
  return n.toFixed(digits)
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-"
  return `${(n * 100).toFixed(1)}%`
}

function extractPayload(vc: VerifiableCredential): ReceiptPayload {
  const subject = (vc as { credentialSubject?: Record<string, unknown> }).credentialSubject ?? {}
  const payload = (subject as { payload?: Record<string, unknown> }).payload ?? subject
  return payload as ReceiptPayload
}

/**
 * Derive a TwinDisplayPolicy from a DigitalTwinForecastReceipt VC's embedded
 * tier fields (PR #24). Falls back to `synthesiseDisplayPolicy(backend_used)`
 * when those fields are absent so older VCs still render correctly.
 */
export function policyFromVc(vc: VerifiableCredential): TwinDisplayPolicy {
  const payload = extractPayload(vc)
  const backendUsed: MechanisticBackendUsed =
    (payload.backend_used as MechanisticBackendUsed | undefined) ?? "fallback-exponential"
  const lowConfidence = Array.isArray(payload.low_confidence_outcomes)
    ? payload.low_confidence_outcomes
    : []
  // Mechanistic-sidecar v0.4.0+ tags 2-cmt runs with model_version
  // "mechanistic-sidecar-pkpd-2cmt@..."; surface that profile so verifier
  // badges can distinguish 1-cmt vs 2-cmt without re-parsing the version.
  // DigitalTwinComparisonReceipt VCs (PR #39) embed `pkpd_profile` directly,
  // so prefer that explicit field when present and fall back to the
  // model_version sniff for older forecast receipts.
  const explicitProfile =
    payload.pkpd_profile === "2-cmt" || payload.pkpd_profile === "1-cmt"
      ? (payload.pkpd_profile as "2-cmt" | "1-cmt")
      : null
  const modelVersion =
    typeof payload.model_version === "string" ? payload.model_version : undefined
  const pkpdProfile =
    backendUsed === "mechanistic"
      ? (explicitProfile ?? (modelVersion?.includes("pkpd-2cmt") ? "2-cmt" : "1-cmt"))
      : null
  return synthesiseDisplayPolicy(backendUsed, lowConfidence, pkpdProfile)
}

interface TextOp {
  text: string
  font: "F1" | "F2"
  size: number
  x: number
  y: number
}

interface RectOp {
  x: number
  y: number
  w: number
  h: number
  fill: [number, number, number]
}

const PAGE_WIDTH = 612 // US Letter
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const TOP_Y = PAGE_HEIGHT - 60

function buildOps(input: DigitalTwinPdfInput): { text: TextOp[]; rects: RectOp[] } {
  const { vc } = input
  const policy = input.policy ?? policyFromVc(vc)
  const payload = extractPayload(vc)
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const text: TextOp[] = []
  const rects: RectOp[] = []

  let y = TOP_Y

  // Header
  text.push({ text: "Biozephyra Digital-Twin Forecast Receipt", font: "F2", size: 16, x: MARGIN_X, y })
  y -= 22
  text.push({
    text: `Issued ${asciiOnly(String(vc.issuanceDate ?? generatedAt))}  /  VC id ${asciiOnly(String(vc.id ?? "unknown"))}`,
    font: "F1",
    size: 9,
    x: MARGIN_X,
    y,
  })
  y -= 18

  // Banner per display tier
  if (policy.tier !== "calibrated") {
    const bannerFill: [number, number, number] =
      policy.tier === "illustrative" ? [0.86, 0.16, 0.16] : [0.92, 0.62, 0.13]
    rects.push({ x: MARGIN_X, y: y - 24, w: PAGE_WIDTH - 2 * MARGIN_X, h: 26, fill: bannerFill })
    const bannerText =
      policy.tier === "illustrative"
        ? "ILLUSTRATIVE - NOT CLINICAL GUIDANCE"
        : "CALIBRATED (partial) - clinician review required"
    text.push({ text: bannerText, font: "F2", size: 11, x: MARGIN_X + 8, y: y - 18 })
    y -= 36
    text.push({
      text: asciiOnly(policy.badgeTooltip).slice(0, 180),
      font: "F1",
      size: 9,
      x: MARGIN_X,
      y,
    })
    y -= 18
  }

  if (input.recipient) {
    text.push({ text: `Recipient: ${asciiOnly(input.recipient)}`, font: "F1", size: 11, x: MARGIN_X, y })
    y -= 16
  }

  // Run metadata block
  text.push({ text: "Simulation metadata", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 16
  const metadataLines = [
    `simulation_id: ${asciiOnly(String(payload.simulation_id ?? "-"))}`,
    `backend_used: ${asciiOnly(String(payload.backend_used ?? policy.backendUsed))}`,
    `model_version: ${asciiOnly(String(payload.model_version ?? "-"))}`,
    `horizon_weeks: ${payload.horizon_weeks ?? "-"}`,
    `display_tier: ${policy.tier}`,
    ...(policy.pkpdProfile
      ? [`pkpd_profile: ${policy.pkpdProfile === "2-cmt" ? "2-compartment" : "1-compartment"}`]
      : []),
  ]
  for (const line of metadataLines) {
    text.push({ text: line, font: "F1", size: 10, x: MARGIN_X, y })
    y -= 13
  }
  y -= 6

  // Low-confidence outcomes call-out (mirrors stack-comparison-pdf). Renders
  // before the (potentially truncated) outcome table so the names are always
  // visible even when many outcomes overflow the page.
  const lowConfidence = Array.from(
    new Set(policy.lowConfidenceOutcomes ?? []),
  ).sort()
  if (lowConfidence.length > 0) {
    text.push({ text: "Low-confidence outcomes", font: "F2", size: 11, x: MARGIN_X, y })
    y -= 14
    text.push({
      text: asciiOnly(`* ${lowConfidence.join(", ")} (clinician review recommended)`).slice(0, 160),
      font: "F1",
      size: 9,
      x: MARGIN_X,
      y,
    })
    y -= 16
  }

  // Interventions
  text.push({ text: "Interventions", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 16
  const interventions = payload.interventions ?? []
  if (interventions.length === 0) {
    text.push({ text: "(none recorded)", font: "F1", size: 10, x: MARGIN_X, y })
    y -= 13
  } else {
    for (const iv of interventions) {
      const dose = iv.dose !== undefined && iv.dose !== null ? String(iv.dose) : "-"
      const schedule = iv.schedule ?? "-"
      const range = `weeks ${iv.start_week ?? 0}-${iv.stop_week ?? "end"}`
      text.push({
        text: asciiOnly(`- ${iv.intervention_id} (${dose}, ${schedule}, ${range})`),
        font: "F1",
        size: 10,
        x: MARGIN_X,
        y,
      })
      y -= 13
    }
  }
  y -= 6

  // Outcome summaries
  text.push({ text: "Outcome summaries", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 16
  text.push({
    text: "outcome              baseline    final_mean   delta       delta%      95% CI (final)   conf",
    font: "F2",
    size: 9,
    x: MARGIN_X,
    y,
  })
  y -= 12
  const summaries = payload.outcome_summaries ?? []
  for (const s of summaries) {
    const conf = s.low_confidence_flag ? "low" : "ok"
    const marker = s.low_confidence_flag ? "*" : " "
    const lineText =
      `${(marker + s.outcome).padEnd(20).slice(0, 20)}` +
      ` ${fmt(s.baseline).padStart(9)}` +
      ` ${fmt(s.final_week_mean).padStart(12)}` +
      ` ${fmt(s.total_delta).padStart(11)}` +
      ` ${fmtPct(s.total_delta_pct).padStart(10)}` +
      ` [${fmt(s.ci95_final?.[0])}, ${fmt(s.ci95_final?.[1])}]`.padStart(18) +
      ` ${conf.padStart(4)}`
    text.push({ text: asciiOnly(lineText), font: "F1", size: 9, x: MARGIN_X, y })
    y -= 12
    if (y < 120) break
  }

  // Footer
  text.push({
    text: `Generated ${asciiOnly(generatedAt)} - Biozephyra platform - VC issuer ${asciiOnly(String(vc.issuer ?? "-"))}`,
    font: "F1",
    size: 8,
    x: MARGIN_X,
    y: 54,
  })
  text.push({
    text:
      policy.requiresClinicianBanner
        ? "This receipt is informational only and requires clinician review before any clinical decision."
        : "This receipt records a calibrated forecast. Consult your clinician before acting on it.",
    font: "F1",
    size: 8,
    x: MARGIN_X,
    y: 42,
  })

  return { text, rects }
}

function buildContentStream(ops: { text: TextOp[]; rects: RectOp[] }): string {
  const parts: string[] = []
  for (const r of ops.rects) {
    parts.push(`${r.fill[0].toFixed(3)} ${r.fill[1].toFixed(3)} ${r.fill[2].toFixed(3)} rg`)
    parts.push(`${r.x} ${r.y} ${r.w} ${r.h} re f`)
  }
  // Reset fill to black for text
  parts.push("0 0 0 rg")
  for (const t of ops.text) {
    parts.push("BT")
    parts.push(`/${t.font} ${t.size} Tf`)
    parts.push(`${t.x} ${t.y} Td`)
    // Banner text on coloured background gets white fill
    const onBanner =
      ops.rects.find(
        (r) => t.y >= r.y && t.y <= r.y + r.h && t.x >= r.x && t.x <= r.x + r.w,
      ) !== undefined
    if (onBanner) parts.push("1 1 1 rg")
    parts.push(`(${t.text}) Tj`)
    if (onBanner) parts.push("0 0 0 rg")
    parts.push("ET")
  }
  return parts.join("\n")
}

/**
 * Render the receipt to a PDF byte stream. The result is a deterministic
 * single-page PDF when `generatedAt` is fixed.
 */
export function renderDigitalTwinForecastPDF(input: DigitalTwinPdfInput): Uint8Array {
  const ops = buildOps(input)
  const content = buildContentStream(ops)
  const contentBytes = new TextEncoder().encode(content)

  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Page
  // Object 4: Font Helvetica
  // Object 5: Font Helvetica-Bold
  // Object 6: Contents
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
  ]

  // Assemble file
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"
  const chunks: string[] = [header]
  const offsets: number[] = []
  let byteLen = new TextEncoder().encode(header).length
  objects.forEach((body, idx) => {
    const objStr = `${idx + 1} 0 obj\n${body}\nendobj\n`
    offsets.push(byteLen)
    chunks.push(objStr)
    byteLen += new TextEncoder().encode(objStr).length
  })
  const xrefOffset = byteLen
  let xref = `xref\n0 ${objects.length + 1}\n`
  xref += "0000000000 65535 f \n"
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, "0")} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(xref)
  chunks.push(trailer)

  // Concatenate as bytes
  const out: Uint8Array[] = chunks.map((c) => new TextEncoder().encode(c))
  const total = out.reduce((acc, b) => acc + b.length, 0)
  const result = new Uint8Array(total)
  let cursor = 0
  for (const b of out) {
    result.set(b, cursor)
    cursor += b.length
  }
  return result
}
