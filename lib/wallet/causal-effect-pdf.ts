/**
 * causal-effect-pdf — renders a `CausalEffectEstimate` Verifiable Credential
 * to a single-page PDF suitable for a clinician or patient wallet.
 *
 * Mirrors the zero-dependency PDF 1.4 writer in `digital-twin-pdf.ts`:
 * 14 built-in PDF core fonts only, ASCII text only, deterministic when
 * `generatedAt` is fixed. Wallet UIs and clinician portals can serve the
 * resulting bytes with `Content-Type: application/pdf` directly.
 *
 * Display chrome:
 *   - low_evidence  → amber banner "LOW EVIDENCE - clinician review required"
 *   - otherwise     → no banner; the strong-evidence label is shown inline
 */

import { causalSummaryFromVc, type CausalSummary } from "@/lib/agents/causal-summary"
import type { VerifiableCredential } from "@/lib/sidecars"

export interface CausalEffectPdfInput {
  vc: VerifiableCredential
  /** Optional pre-computed summary; derived from the VC when omitted. */
  summary?: CausalSummary
  /** Optional clinician/patient name to print as the recipient line. */
  recipient?: string
  /** Optional ISO date string overriding `new Date().toISOString()`. */
  generatedAt?: string
}

export class CausalEffectPdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CausalEffectPdfError"
  }
}

function asciiOnly(value: string): string {
  let out = ""
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    let ch = value[i]
    if (code < 0x20 || code > 0x7e) ch = "?"
    if (ch === "\\" || ch === "(" || ch === ")") out += "\\" + ch
    else out += ch
  }
  return out
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

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const TOP_Y = PAGE_HEIGHT - 60

function buildOps(
  input: CausalEffectPdfInput,
  summary: CausalSummary,
): { text: TextOp[]; rects: RectOp[] } {
  const { vc } = input
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const text: TextOp[] = []
  const rects: RectOp[] = []

  let y = TOP_Y

  text.push({
    text: "Biozephyra Causal Effect Estimate Receipt",
    font: "F2",
    size: 16,
    x: MARGIN_X,
    y,
  })
  y -= 22
  text.push({
    text: `Issued ${asciiOnly(String(vc.issuanceDate ?? generatedAt))}  /  VC id ${asciiOnly(String(vc.id ?? "unknown"))}`,
    font: "F1",
    size: 9,
    x: MARGIN_X,
    y,
  })
  y -= 18

  if (summary.low_evidence) {
    const fill: [number, number, number] = [0.92, 0.62, 0.13]
    rects.push({ x: MARGIN_X, y: y - 24, w: PAGE_WIDTH - 2 * MARGIN_X, h: 26, fill })
    text.push({
      text: "LOW EVIDENCE - clinician review required",
      font: "F2",
      size: 11,
      x: MARGIN_X + 8,
      y: y - 18,
    })
    y -= 36
    text.push({
      text: asciiOnly(summary.evidence_label).slice(0, 180),
      font: "F1",
      size: 9,
      x: MARGIN_X,
      y,
    })
    y -= 18
  }

  if (input.recipient) {
    text.push({
      text: `Recipient: ${asciiOnly(input.recipient)}`,
      font: "F1",
      size: 11,
      x: MARGIN_X,
      y,
    })
    y -= 16
  }

  text.push({ text: "Effect estimate", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 16
  const lines = [
    `intervention:           ${asciiOnly(summary.intervention)}`,
    `outcome:                ${asciiOnly(summary.outcome)}`,
    `expected_delta:         ${summary.expected_delta.toFixed(3)}`,
    `95% CI:                 [${summary.ci95[0].toFixed(3)}, ${summary.ci95[1].toFixed(3)}]`,
    `cohort_source:          ${asciiOnly(summary.cohort_source)}`,
    `n_similar_profiles:     ${summary.n_similar_profiles}`,
    `identification:         ${asciiOnly(summary.identification_strategy)}`,
    `model_version:          ${asciiOnly(summary.model_version)}`,
  ]
  for (const line of lines) {
    text.push({ text: line, font: "F1", size: 10, x: MARGIN_X, y })
    y -= 13
  }
  y -= 6

  text.push({ text: "Summary", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 14
  text.push({
    text: asciiOnly(summary.effect_label).slice(0, 180),
    font: "F1",
    size: 10,
    x: MARGIN_X,
    y,
  })
  y -= 14
  text.push({
    text: asciiOnly(summary.evidence_label).slice(0, 180),
    font: "F1",
    size: 10,
    x: MARGIN_X,
    y,
  })

  text.push({
    text: `Generated ${asciiOnly(generatedAt)} - Biozephyra platform - VC issuer ${asciiOnly(String(vc.issuer ?? "-"))}`,
    font: "F1",
    size: 8,
    x: MARGIN_X,
    y: 54,
  })
  text.push({
    text: summary.low_evidence
      ? "This estimate is informational only and requires clinician review before any clinical decision."
      : "This receipt records a causal effect estimate. Consult your clinician before acting on it.",
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
  parts.push("0 0 0 rg")
  for (const t of ops.text) {
    parts.push("BT")
    parts.push(`/${t.font} ${t.size} Tf`)
    parts.push(`${t.x} ${t.y} Td`)
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
 * Render a CausalEffectEstimate VC to a PDF byte stream. Throws
 * `CausalEffectPdfError` when the VC isn't a CausalEffectEstimate or its
 * payload lacks required fields.
 */
export function renderCausalEffectPDF(input: CausalEffectPdfInput): Uint8Array {
  const summary = input.summary ?? causalSummaryFromVc(input.vc)
  if (!summary) {
    throw new CausalEffectPdfError(
      "vc is not a CausalEffectEstimate or its payload is missing required fields",
    )
  }
  const ops = buildOps(input, summary)
  const content = buildContentStream(ops)
  const contentBytes = new TextEncoder().encode(content)

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
  ]

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
  for (const off of offsets) xref += `${off.toString().padStart(10, "0")} 00000 n \n`
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(xref)
  chunks.push(trailer)

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
