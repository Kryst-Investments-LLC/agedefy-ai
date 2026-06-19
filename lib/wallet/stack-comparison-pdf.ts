/**
 * stack-comparison-pdf — renders a one-page A4/Letter PDF comparing two
 * intervention stacks against the same baseline, using the same display-tier
 * policy as the single-stack receipt (`lib/wallet/digital-twin-pdf.ts`).
 *
 * Zero-dep PDF 1.4 writer; ASCII-only text; deterministic for a fixed
 * `generatedAt`. The display tier is determined by the caller (typically the
 * compare-stacks route, which downgrades the pair to the weaker side).
 */

import type { CompareStacksResponse } from "@/lib/sidecars"
import type { TwinDisplayPolicy } from "@/lib/agents/twin-display-policy"

export interface StackComparisonPdfInput {
  /** Optional caption (e.g. "Stack A vs Stack B"). */
  title?: string
  comparison: CompareStacksResponse
  policy: TwinDisplayPolicy
  /** Optional clinician/patient label printed under the header. */
  recipient?: string
  /** Optional ISO date string overriding `new Date().toISOString()`. */
  generatedAt?: string
  /** Human labels for the two stacks; default "Stack A" / "Stack B". */
  stackLabels?: { a: string; b: string }
}

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const TOP_Y = PAGE_HEIGHT - 60

interface TextOp { text: string; font: "F1" | "F2"; size: number; x: number; y: number }
interface RectOp { x: number; y: number; w: number; h: number; fill: [number, number, number] }

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

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-"
  return n.toFixed(digits)
}

function buildOps(input: StackComparisonPdfInput): { text: TextOp[]; rects: RectOp[] } {
  const { comparison, policy } = input
  const labels = input.stackLabels ?? { a: "Stack A", b: "Stack B" }
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const text: TextOp[] = []
  const rects: RectOp[] = []

  let y = TOP_Y

  text.push({
    text: asciiOnly(input.title ?? "Biozephyra Stack Comparison Report"),
    font: "F2",
    size: 16,
    x: MARGIN_X,
    y,
  })
  y -= 22
  text.push({
    text: `Generated ${asciiOnly(generatedAt)}  /  ${asciiOnly(labels.a)} vs ${asciiOnly(labels.b)}`,
    font: "F1",
    size: 9,
    x: MARGIN_X,
    y,
  })
  y -= 18

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

  text.push({ text: "Comparison metadata", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 16
  const metaLines = [
    `simulation_id_a: ${asciiOnly(comparison.simulation_id_a)}`,
    `simulation_id_b: ${asciiOnly(comparison.simulation_id_b)}`,
    `backend_used:    ${asciiOnly(policy.backendUsed)}`,
    `display_tier:    ${policy.tier}`,
    ...(policy.pkpdProfile
      ? [`pkpd_profile:    ${policy.pkpdProfile === "2-cmt" ? "2-compartment" : "1-compartment"}`]
      : []),
  ]
  for (const line of metaLines) {
    text.push({ text: line, font: "F1", size: 10, x: MARGIN_X, y })
    y -= 13
  }
  y -= 6

  const lowConfidence = new Set(policy.lowConfidenceOutcomes ?? [])
  if (lowConfidence.size > 0) {
    text.push({ text: "Low-confidence outcomes", font: "F2", size: 11, x: MARGIN_X, y })
    y -= 14
    const list = Array.from(lowConfidence).sort().join(", ")
    text.push({
      text: asciiOnly(`* ${list} (clinician review recommended)`).slice(0, 160),
      font: "F1",
      size: 9,
      x: MARGIN_X,
      y,
    })
    y -= 16
  }

  text.push({ text: "Delta-of-deltas by outcome", font: "F2", size: 12, x: MARGIN_X, y })
  y -= 16
  text.push({
    text:
      "outcome              " +
      `${labels.a.padStart(12).slice(0, 12)} ` +
      `${labels.b.padStart(12).slice(0, 12)} ` +
      "difference   95% CI",
    font: "F2",
    size: 9,
    x: MARGIN_X,
    y,
  })
  y -= 12
  const entries = Object.entries(comparison.delta_of_deltas)
  if (entries.length === 0) {
    text.push({ text: "(no comparable outcomes)", font: "F1", size: 10, x: MARGIN_X, y })
    y -= 13
  } else {
    for (const [outcome, row] of entries) {
      const marker = lowConfidence.has(outcome) ? "*" : " "
      const lineText =
        (marker + outcome).padEnd(20).slice(0, 20) +
        " " +
        fmt(row.stack_a_final).padStart(12) +
        " " +
        fmt(row.stack_b_final).padStart(12) +
        " " +
        fmt(row.difference).padStart(12) +
        "   " +
        `[${fmt(row.ci95?.[0])}, ${fmt(row.ci95?.[1])}]`
      text.push({ text: asciiOnly(lineText), font: "F1", size: 9, x: MARGIN_X, y })
      y -= 12
      if (y < 120) break
    }
  }

  text.push({
    text: `Backend: ${asciiOnly(policy.backendUsed)} - ${asciiOnly(policy.badgeLabel)}`,
    font: "F1",
    size: 8,
    x: MARGIN_X,
    y: 54,
  })
  text.push({
    text: policy.requiresClinicianBanner
      ? "This report is informational only and requires clinician review before any clinical decision."
      : "This report records a calibrated comparison. Consult your clinician before acting on it.",
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

export function renderStackComparisonPDF(input: StackComparisonPdfInput): Uint8Array {
  const ops = buildOps(input)
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
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
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
