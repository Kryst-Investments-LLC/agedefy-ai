'use client'

import { useState } from 'react'
import { FlaskConical, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LogResultDialogProps {
  candidateId: string
  candidateName: string
  onLogged: () => void
}

export function LogResultDialog({
  candidateId,
  candidateName,
  onLogged,
}: LogResultDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assayName, setAssayName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [operator, setOperator] = useState<'=' | '<' | '>'>('=')
  const [flag, setFlag] = useState('')
  const [assayType, setAssayType] = useState('')
  const [lab, setLab] = useState('')
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')

  const reset = () => {
    setAssayName('')
    setValue('')
    setUnit('')
    setOperator('=')
    setFlag('')
    setAssayType('')
    setLab('')
    setMeasuredAt(new Date().toISOString().slice(0, 16))
    setNotes('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numVal = parseFloat(value)
    if (isNaN(numVal)) {
      setError('Value must be a number.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/experiment/candidates/${candidateId}/lab-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assayName: assayName.trim(),
          value: numVal,
          unit: unit.trim(),
          operator,
          flag: flag || undefined,
          assayType: assayType || undefined,
          lab: lab.trim() || undefined,
          measuredAt: new Date(measuredAt).toISOString(),
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `Error ${res.status}`)
      }

      reset()
      setOpen(false)
      onLogged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log result')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5" />
          Log Result
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Log Lab Result
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{candidateName}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="assay-name" className="text-xs">Assay name *</Label>
              <Input
                id="assay-name"
                placeholder="e.g. IC50_SIRT1, cell_viability_%"
                value={assayName}
                onChange={(e) => setAssayName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Operator</Label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as '=' | '<' | '>')}
                disabled={loading}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="=">=</option>
                <option value="<">&lt; (below LOD)</option>
                <option value=">">&gt;</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="value" className="text-xs">Value *</Label>
              <Input
                id="value"
                type="number"
                step="any"
                placeholder="0.05"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unit" className="text-xs">Unit *</Label>
              <Input
                id="unit"
                placeholder="µM, %, nM"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Flag</Label>
              <select
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                disabled={loading}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="borderline">Borderline</option>
                <option value="toxic">Toxic</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Assay type</Label>
              <select
                value={assayType}
                onChange={(e) => setAssayType(e.target.value)}
                disabled={loading}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                <option value="biochemical">Biochemical</option>
                <option value="cellular">Cellular</option>
                <option value="animal">Animal</option>
                <option value="in_silico">In silico</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lab" className="text-xs">Lab / CRO</Label>
              <Input
                id="lab"
                placeholder="Institution or CRO name"
                value={lab}
                onChange={(e) => setLab(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="measured-at" className="text-xs">Measured at *</Label>
              <Input
                id="measured-at"
                type="datetime-local"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="notes" className="text-xs">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !assayName || !value || !unit}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Result
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
