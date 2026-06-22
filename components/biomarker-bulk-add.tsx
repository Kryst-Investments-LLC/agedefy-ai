"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parsePanel, type ParsedBiomarkerRow } from "@/lib/biomarkers/parse-panel"

const PLACEHOLDER = `Paste your lab results, one per line. For example:
LDL 165 mg/dL
HDL 62 mg/dL
HbA1c 5.6 %
CRP 2.4 mg/L
Vitamin D 22 ng/mL
TSH 1.8 mIU/L`

type Row = ParsedBiomarkerRow & { id: string }

/**
 * Paste a whole lab panel → parse into rows → review/edit → save them all at
 * once. Saving reuses POST /api/biomarkers per row, so every biomarker still
 * fires the same audit + canonical-event + loop-trigger pipeline as the single
 * add form.
 */
export function BiomarkerBulkAdd() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [text, setText] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [parsed, setParsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParse = () => {
    setError(null)
    const { rows: parsedRows, skipped: skip } = parsePanel(text)
    setRows(parsedRows.map((r, i) => ({ ...r, id: `${i}-${r.name}` })))
    setSkipped(skip)
    setParsed(true)
  }

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  const handleSave = async () => {
    setError(null)
    const valid = rows.filter((r) => r.name.trim() && Number.isFinite(Number(r.value)))
    if (valid.length === 0) {
      setError("Nothing to save — add at least one valid row.")
      return
    }
    setSaving(true)
    setProgress({ done: 0, total: valid.length })
    let saved = 0
    try {
      for (const r of valid) {
        const res = await fetch("/api/biomarkers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: r.name.trim(),
            value: String(r.value),
            unit: r.unit.trim(),
            target: "",
            trend: "STABLE",
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? `Failed saving "${r.name}" (HTTP ${res.status})`)
        }
        saved += 1
        setProgress({ done: saved, total: valid.length })
      }
      // reset + refresh the dashboard so the new biomarkers show
      setText("")
      setRows([])
      setSkipped([])
      setParsed(false)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "Save failed"}. ${saved} of ${valid.length} saved.`,
      )
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bulk add — paste your panel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste a whole lab report and we&apos;ll turn it into biomarkers. Review and
          edit before saving. Use US units (mg/dL, ng/mL, %…) so the analysis is accurate.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="h-44 font-mono text-sm"
            />
            <Button onClick={handleParse} disabled={!text.trim()} className="bg-teal-600 hover:bg-teal-700">
              Parse panel
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {rows.length} biomarker{rows.length === 1 ? "" : "s"} found — review &amp; edit:
              </p>
              <Button variant="ghost" size="sm" onClick={() => setParsed(false)}>
                ← Back to paste
              </Button>
            </div>

            {rows.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_90px_90px_32px] gap-2 px-1 text-xs text-muted-foreground">
                  <span>Name</span><span>Value</span><span>Unit</span><span />
                </div>
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_90px_90px_32px] items-center gap-2">
                    <Input value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} className="h-9" />
                    <Input
                      value={String(r.value)}
                      onChange={(e) => updateRow(r.id, { value: Number(e.target.value) })}
                      className="h-9 font-mono"
                      inputMode="decimal"
                    />
                    <Input value={r.unit} onChange={(e) => updateRow(r.id, { unit: e.target.value })} className="h-9 font-mono" />
                    <button
                      onClick={() => removeRow(r.id)}
                      className="text-muted-foreground hover:text-red-500"
                      aria-label={`Remove ${r.name}`}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {skipped.length > 0 && (
              <details className="rounded-md border border-amber-300/40 bg-amber-500/5 p-3 text-xs">
                <summary className="cursor-pointer text-amber-600 dark:text-amber-300">
                  {skipped.length} line{skipped.length === 1 ? "" : "s"} couldn&apos;t be read (click to view)
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-muted-foreground">
                  {skipped.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </details>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || rows.length === 0} className="bg-teal-600 hover:bg-teal-700">
                {saving
                  ? `Saving ${progress?.done ?? 0}/${progress?.total ?? rows.length}…`
                  : `Save ${rows.length} biomarker${rows.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Label className="block text-[11px] text-muted-foreground">
          Tip: most lab apps let you copy results as text. Reference ranges in (parentheses) are ignored automatically.
        </Label>
      </CardContent>
    </Card>
  )
}
