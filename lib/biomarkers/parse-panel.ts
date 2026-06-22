/**
 * Parse a pasted lab panel (free text) into structured biomarker rows.
 *
 * Lab reports vary wildly, so this is intentionally forgiving and pairs with an
 * editable preview in the UI — the user confirms/corrects before saving. It
 * extracts, per line: a name, the first plausible numeric value, and an optional
 * unit; reference ranges in (parens) or [brackets] are stripped.
 */

export interface ParsedBiomarkerRow {
  name: string
  value: number
  unit: string
  /** The original line, for the "skipped/edited" UI. */
  raw: string
}

export interface ParsePanelResult {
  rows: ParsedBiomarkerRow[]
  /** Lines we couldn't parse (headers, notes, blanks are not included). */
  skipped: string[]
}

// Matches a value optionally followed by a known-ish unit token at end of line.
// Name is non-greedy + the line is end-anchored, so the LAST number on the line
// becomes the value — which handles names that contain numbers (B12, 25-OH, Omega-3).
const LINE_RE =
  /^([A-Za-z][A-Za-z0-9 ,.\-/'()]*?)[\s:=,\t]+(-?\d+(?:\.\d+)?)[\s,\t]*([A-Za-z%µ°][A-Za-z0-9%µ°^]*(?:\/[A-Za-z0-9µ^]+)*)?\s*$/

function stripRanges(line: string): string {
  return line
    .replace(/\([^)]*\)/g, " ")        // (0-3)
    .replace(/\[[^\]]*\]/g, " ")        // [ref ...]
    .replace(/\bref(?:erence)?\b.*$/i, " ") // "ref: ..."
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** True for obvious header / non-result lines (no digit at all). */
function looksLikeHeader(line: string): boolean {
  return !/\d/.test(line)
}

export function parsePanel(text: string): ParsePanelResult {
  const rows: ParsedBiomarkerRow[] = []
  const skipped: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (looksLikeHeader(line)) continue // silently drop pure-text header lines

    const cleaned = stripRanges(line)
    const m = cleaned.match(LINE_RE)
    if (!m) {
      skipped.push(line)
      continue
    }

    const name = m[1].trim().replace(/[,:;-]+$/, "").trim()
    const value = Number.parseFloat(m[2])
    const unit = (m[3] ?? "").trim()

    if (!name || !Number.isFinite(value)) {
      skipped.push(line)
      continue
    }
    rows.push({ name, value, unit, raw: line })
  }

  return { rows, skipped }
}
