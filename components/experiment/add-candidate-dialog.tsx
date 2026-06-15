'use client'

import { useState } from 'react'
import { PlusCircle, Loader2 } from 'lucide-react'
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

interface AddCandidateDialogProps {
  onAdded: () => void
}

export function AddCandidateDialog({ onAdded }: AddCandidateDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<'CHEMBL' | 'AI'>('CHEMBL')
  const [displayName, setDisplayName] = useState('')
  const [smiles, setSmiles] = useState('')
  const [chemblId, setChemblId] = useState('')
  const [targetName, setTargetName] = useState('')
  const [hypothesisNote, setHypothesisNote] = useState('')

  const reset = () => {
    setKind('CHEMBL')
    setDisplayName('')
    setSmiles('')
    setChemblId('')
    setTargetName('')
    setHypothesisNote('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        kind,
        displayName: displayName.trim(),
        smiles: smiles.trim() || undefined,
        targetName: targetName.trim() || undefined,
        hypothesisNote: hypothesisNote.trim() || undefined,
      }

      if (kind === 'CHEMBL' && chemblId.trim()) {
        body.chemblId = chemblId.trim().toUpperCase()
      }

      const res = await fetch('/api/experiment/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? `Error ${res.status}`)
      }

      reset()
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add candidate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center gap-1.5">
          <PlusCircle className="h-4 w-4" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Experiment Candidate</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Kind toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <div className="flex gap-2">
              {(['CHEMBL', 'AI'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
                    kind === k
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  {k === 'CHEMBL' ? 'ChEMBL compound' : 'AI hypothesis'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="text-xs">Name *</Label>
            <Input
              id="display-name"
              placeholder={kind === 'CHEMBL' ? 'e.g. Resveratrol' : 'e.g. BZP-SIRT1-42'}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {kind === 'CHEMBL' && (
            <div className="space-y-1.5">
              <Label htmlFor="chembl-id" className="text-xs">ChEMBL ID</Label>
              <Input
                id="chembl-id"
                placeholder="e.g. CHEMBL413"
                value={chemblId}
                onChange={(e) => setChemblId(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="smiles" className="text-xs">SMILES</Label>
            <Input
              id="smiles"
              placeholder="Canonical SMILES string"
              value={smiles}
              onChange={(e) => setSmiles(e.target.value)}
              disabled={loading}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target" className="text-xs">Target name</Label>
            <Input
              id="target"
              placeholder="e.g. SIRT1, mTOR, p16"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hypothesis" className="text-xs">Why this candidate?</Label>
            <Input
              id="hypothesis"
              placeholder="Brief rationale for proposing this compound"
              value={hypothesisNote}
              onChange={(e) => setHypothesisNote(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !displayName.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to Pipeline
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
