"use client"

import { useState, FormEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ExternalLink, Calendar, FlaskConical, Loader2 } from "lucide-react"

interface Trial {
  nctId: string
  title: string
  status: string
  startDate: string | null
  conditions: string[]
  url: string
}

const statusColor: Record<string, string> = {
  RECRUITING: "bg-green-600 text-white",
  "ACTIVE_NOT_RECRUITING": "bg-blue-600 text-white",
  "ACTIVE, NOT YET RECRUITING": "bg-blue-600 text-white",
  COMPLETED: "bg-gray-600 text-foreground",
  "NOT_YET_RECRUITING": "bg-yellow-600 text-foreground",
  ENROLLING_BY_INVITATION: "bg-teal-600 text-white",
}

const SUGGESTED_QUERIES = [
  "rapamycin aging",
  "NAD+ supplementation",
  "senolytic therapy",
  "metformin longevity",
  "epigenetic clock",
  "telomere extension",
  "caloric restriction aging",
  "fisetin senescence",
]

export function ClinicalTrialsExplorer() {
  const [query, setQuery] = useState("")
  const [trials, setTrials] = useState<Trial[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const doSearch = async (q: string) => {
    if (q.length < 2) return
    setLoading(true)
    setSearched(true)
    setSavedMsg(null)
    try {
      const res = await fetch(`/api/clinical-trials/search?q=${encodeURIComponent(q)}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setTrials(data.trials ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    doSearch(query)
  }

  const saveToCollection = async () => {
    if (trials.length === 0) return
    setSaving(true)
    try {
      const res = await fetch("/api/research/clinical-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionName: `Clinical Trials: ${query}`,
          query,
          maxResults: trials.length,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedMsg(`Saved ${data.collection?.entries?.length ?? 0} trials to your research collections`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" /> Search Clinical Trials
          </CardTitle>
          <CardDescription>
            Query ClinicalTrials.gov in real time for aging and longevity studies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trials (e.g. rapamycin aging, NAD+ supplementation)…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading || query.length < 2}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTED_QUERIES.map((sq) => (
              <Button
                key={sq}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => { setQuery(sq); doSearch(sq) }}
              >
                {sq}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{loading ? "Searching…" : `${trials.length} trial${trials.length !== 1 ? "s" : ""} found`}</CardTitle>
              {trials.length > 0 && (
                <Button variant="outline" size="sm" onClick={saveToCollection} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save to research collection
                </Button>
              )}
            </div>
            {savedMsg && <p className="text-sm text-green-600 dark:text-green-400 mt-1">{savedMsg}</p>}
          </CardHeader>
          <CardContent>
            {trials.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No clinical trials matched your query. Try different keywords.</p>
            )}
            <div className="space-y-4">
              {trials.map((trial) => (
                <div key={trial.nctId} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`text-xs ${statusColor[trial.status] ?? "bg-gray-600 text-foreground"}`}>
                          {trial.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{trial.nctId}</span>
                      </div>
                      <p className="font-medium text-sm leading-snug">{trial.title}</p>
                    </div>
                    <a href={trial.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trial.conditions.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                    {trial.startDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Started {trial.startDate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Data sourced from ClinicalTrials.gov, a service of the U.S. National Library of Medicine.
        This is informational only and does not constitute medical advice or enrollment recommendation.
      </p>
    </div>
  )
}
