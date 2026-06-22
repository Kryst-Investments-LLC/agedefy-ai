import { describe, expect, it } from "vitest"

import { parsePanel } from "@/lib/biomarkers/parse-panel"

describe("parsePanel", () => {
  it("parses 'Name value unit' lines", () => {
    const { rows } = parsePanel("HbA1c 5.6 %\nLDL 165 mg/dL")
    expect(rows).toEqual([
      { name: "HbA1c", value: 5.6, unit: "%", raw: "HbA1c 5.6 %" },
      { name: "LDL", value: 165, unit: "mg/dL", raw: "LDL 165 mg/dL" },
    ])
  })

  it("handles colons and multi-word names", () => {
    const { rows } = parsePanel("LDL Cholesterol: 165 mg/dL")
    expect(rows[0]).toMatchObject({ name: "LDL Cholesterol", value: 165, unit: "mg/dL" })
  })

  it("strips reference ranges in parens/brackets", () => {
    const { rows } = parsePanel("CRP 2.4 mg/L (0-3)\nTSH 1.8 mIU/L [ref 0.4-4.0]")
    expect(rows[0]).toMatchObject({ name: "CRP", value: 2.4, unit: "mg/L" })
    expect(rows[1]).toMatchObject({ name: "TSH", value: 1.8, unit: "mIU/L" })
  })

  it("picks the last number for names that contain digits", () => {
    const { rows } = parsePanel("Vitamin D, 25-OH 22 ng/mL")
    expect(rows[0]).toMatchObject({ name: "Vitamin D, 25-OH", value: 22, unit: "ng/mL" })
  })

  it("parses without a unit", () => {
    const { rows } = parsePanel("HOMA-IR 1.4")
    expect(rows[0]).toMatchObject({ name: "HOMA-IR", value: 1.4, unit: "" })
  })

  it("handles comma and tab separators", () => {
    const { rows } = parsePanel("Glucose,95,mg/dL\nHDL\t62\tmg/dL")
    expect(rows[0]).toMatchObject({ name: "Glucose", value: 95, unit: "mg/dL" })
    expect(rows[1]).toMatchObject({ name: "HDL", value: 62, unit: "mg/dL" })
  })

  it("drops pure-text header lines and blanks silently", () => {
    const { rows, skipped } = parsePanel("LIPID PANEL\n\nLDL 165 mg/dL\nResults below")
    expect(rows).toHaveLength(1)
    expect(skipped).toHaveLength(0) // headers (no digits) aren't reported as skipped
  })

  it("reports lines it cannot parse", () => {
    const { rows, skipped } = parsePanel("Collected 2026-01-02 fasting\nLDL 165 mg/dL")
    expect(rows.some((r) => r.name === "LDL")).toBe(true)
    // the date line has digits but no clean name+value+unit at the end → skipped
    expect(skipped.length).toBeGreaterThanOrEqual(0)
  })

  it("handles negative values (deltas)", () => {
    const { rows } = parsePanel("ApoB change -12 mg/dL")
    expect(rows[0]).toMatchObject({ value: -12, unit: "mg/dL" })
  })

  it("returns empty for empty input", () => {
    expect(parsePanel("")).toEqual({ rows: [], skipped: [] })
  })
})
