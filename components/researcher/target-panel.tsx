'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { LibrarySearchCriteria } from '@/lib/validators/library-search'

interface TargetPanelProps {
  loading: boolean
  onSearch: (criteria: LibrarySearchCriteria) => void
}

export function TargetPanel({ loading, onSearch }: TargetPanelProps) {
  const [targetName, setTargetName] = useState('')
  const [targetChemblId, setTargetChemblId] = useState('')
  const [minPchembl, setMinPchembl] = useState('')
  const [minPhase, setMinPhase] = useState('')
  const [maxResults, setMaxResults] = useState('25')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const name = targetName.trim()
    const chemblId = targetChemblId.trim().toUpperCase()

    if (!name && !chemblId) {
      setError('Enter a target name or ChEMBL ID to search.')
      return
    }

    if (chemblId && !/^CHEMBL\d+$/.test(chemblId)) {
      setError('ChEMBL ID must match CHEMBL followed by digits, e.g. CHEMBL2842.')
      return
    }

    const criteria: LibrarySearchCriteria = {
      maxResults: Math.min(100, Math.max(1, parseInt(maxResults, 10) || 25)),
    }

    if (name) criteria.targetName = name
    if (chemblId) criteria.targetChemblId = chemblId
    if (minPchembl) criteria.minPchemblValue = parseFloat(minPchembl)
    if (minPhase) criteria.minClinicalPhase = parseInt(minPhase, 10)

    onSearch(criteria)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          Define Target
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="target-name" className="text-xs">Target name</Label>
            <Input
              id="target-name"
              placeholder="e.g. SIRT1, p53, mTOR"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chembl-id" className="text-xs">ChEMBL target ID</Label>
            <Input
              id="chembl-id"
              placeholder="e.g. CHEMBL2842"
              value={targetChemblId}
              onChange={(e) => setTargetChemblId(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Providing an ID skips the name lookup and is more precise.
            </p>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Filters (optional)
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-pchembl" className="text-xs">Min pChEMBL</Label>
                <Input
                  id="min-pchembl"
                  type="number"
                  placeholder="e.g. 6"
                  min={0}
                  max={15}
                  step={0.5}
                  value={minPchembl}
                  onChange={(e) => setMinPchembl(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-phase" className="text-xs">Min clinical phase</Label>
                <Input
                  id="min-phase"
                  type="number"
                  placeholder="0–4"
                  min={0}
                  max={4}
                  step={1}
                  value={minPhase}
                  onChange={(e) => setMinPhase(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-results" className="text-xs">Max candidates</Label>
              <Input
                id="max-results"
                type="number"
                min={1}
                max={100}
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching ChEMBL…
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Library
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Queries the ChEMBL database. Real compounds, real provenance.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
