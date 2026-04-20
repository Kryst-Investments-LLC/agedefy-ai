"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InteractionGraph } from "@/components/interaction-graph"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { AlertTriangle, CheckCircle, Info, Search, Plus, X } from "lucide-react"

interface Compound {
  id: string
  name: string
  category: string
  mechanism: string | null
  aliases: string | null
  pathways: { pathway: { name: string; category: string }; effect: string; strength: string | null }[]
  biomarkerEffects: { biomarkerName: string; direction: string; magnitude: string | null }[]
  _count: { studyLinks: number; interactions: number; interactedWith: number }
}

interface Interaction {
  severity: string
  description: string | null
  compoundA?: { id: string; name: string }
  compoundB?: { id: string; name: string }
}

interface GraphResult {
  id: string
  name: string
  interactions: Interaction[]
  interactedWith: Interaction[]
}

export function CompoundMixer({ initialCompounds = [] }: { initialCompounds?: string[] }) {
  const [query, setQuery] = useState("")
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [selected, setSelected] = useState<Compound[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  function tr(key: string, fallback: string) {
    const v = t(key)
    return v === key ? fallback : v
  }

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setCompounds([]); return }
    const res = await fetch(`/api/compounds?q=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) setCompounds(await res.json())
  }, [])

  // Auto-select compounds passed via initialCompounds prop (e.g. from ?compounds= URL param)
  useEffect(() => {
    if (initialCompounds.length === 0) return
    async function loadInitial() {
      const fetched: Compound[] = []
      for (const name of initialCompounds) {
        const res = await fetch(`/api/compounds?q=${encodeURIComponent(name)}&limit=1`)
        if (res.ok) {
          const results: Compound[] = await res.json()
          if (results.length > 0) fetched.push(results[0])
        }
      }
      setSelected(fetched)
    }
    loadInitial()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  // Check interactions whenever selection changes — single batch request
  useEffect(() => {
    if (selected.length < 2) { setInteractions([]); return }
    setLoading(true)
    const ids = selected.map((c) => c.id).join(",")
    fetch(`/api/knowledge-graph?compounds=${encodeURIComponent(ids)}`)
      .then((r) => r.json() as Promise<GraphResult[]>)
      .then((graphs) => {
        const found: Interaction[] = []
        const selectedIds = new Set(selected.map((s) => s.id))
        for (const g of graphs) {
          for (const ix of [...g.interactions, ...g.interactedWith]) {
            const otherId = ix.compoundB?.id ?? ix.compoundA?.id
            if (otherId && selectedIds.has(otherId)) {
              const key = [g.id, otherId].sort().join("-")
              if (!found.some((f) => {
                const a = f.compoundA?.id ?? ""
                const b = f.compoundB?.id ?? ""
                return [a, b].sort().join("-") === key
              })) {
                found.push(ix)
              }
            }
          }
        }
        setInteractions(found)
      }).finally(() => setLoading(false))
  }, [selected])

  const addCompound = (c: Compound) => {
    if (selected.find((s) => s.id === c.id)) return
    setSelected((prev) => [...prev, c])
    setQuery("")
    setCompounds([])
  }

  const removeCompound = (id: string) => {
    setSelected((prev) => prev.filter((c) => c.id !== id))
  }

  const severityColor: Record<string, string> = {
    BENEFICIAL: "bg-green-600",
    NEUTRAL: "bg-gray-500",
    CAUTION: "bg-yellow-600",
    DANGEROUS: "bg-red-600",
    UNKNOWN: "bg-gray-600",
  }

  const severityIcon: Record<string, typeof CheckCircle> = {
    BENEFICIAL: CheckCircle,
    CAUTION: AlertTriangle,
    DANGEROUS: AlertTriangle,
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{tr("mixer.buildStack", "Build Your Stack")}</CardTitle>
          <CardDescription>{tr("mixer.buildStackDesc", "Search and add compounds to check interactions and pathway coverage.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr("mixer.searchPlaceholder", "Search compounds (e.g. Rapamycin, NMN, Fisetin)\u2026")}
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {compounds.length > 0 && (
            <ul className="mt-2 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground divide-y">
              {compounds.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer" onClick={() => addCompound(c)}>
                  <div>
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{c.category}</Badge>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Selected stack */}
      {selected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tr("mixer.yourStack", "Your Stack")} ({selected.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.map((c) => (
              <div key={c.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link href={`/compounds/${c.id}`} className="font-semibold hover:underline text-teal-400">{c.name}</Link>
                    <Badge variant="outline">{c.category}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeCompound(c.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {c.mechanism && <p className="text-sm text-muted-foreground">{c.mechanism}</p>}

                {c.pathways.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.pathways.map((cp) => (
                      <Badge key={cp.pathway.name} variant="secondary" className="text-xs">
                        {cp.effect === "inhibitor" ? "↓" : cp.effect === "activator" ? "↑" : "~"} {cp.pathway.name}
                        {cp.strength && <span className="ml-1 opacity-60">({cp.strength})</span>}
                      </Badge>
                    ))}
                  </div>
                )}

                {c.biomarkerEffects.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.biomarkerEffects.map((be) => (
                      <Badge key={be.biomarkerName} variant="outline" className="text-xs">
                        {be.direction === "decrease" ? "↓" : be.direction === "increase" ? "↑" : "—"} {be.biomarkerName}
                        {be.magnitude && <span className="ml-1 opacity-60">({be.magnitude})</span>}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Visual interaction graph */}
      {selected.length >= 2 && (
        <InteractionGraph
          compounds={selected.map((c) => ({ id: c.id, name: c.name }))}
          interactions={interactions}
        />
      )}

      {/* Interaction results */}
      {selected.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{tr("mixer.interactions", "Detected Interactions")}</CardTitle>
            <CardDescription>
              {loading ? "Checking\u2026" : `${interactions.length} known interaction(s) between selected compounds.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interactions.length === 0 && !loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                {tr("mixer.noInteractions", "No recorded interactions between these compounds. This does not guarantee safety — consult a clinician.")}
              </div>
            )}
            <div className="space-y-3">
              {interactions.map((ix, i) => {
                const Icon = severityIcon[ix.severity] ?? Info
                return (
                  <div key={i} className="rounded-lg border p-3 flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${ix.severity === "DANGEROUS" ? "text-red-500" : ix.severity === "CAUTION" ? "text-yellow-500" : ix.severity === "BENEFICIAL" ? "text-green-500" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`${severityColor[ix.severity]} text-white text-xs`}>{ix.severity}</Badge>
                        <span className="text-sm font-medium">
                          {ix.compoundA?.name ?? "?"} × {ix.compoundB?.name ?? "?"}
                        </span>
                      </div>
                      {ix.description && <p className="text-sm text-muted-foreground mt-1">{ix.description}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Interaction data is sourced from published research and may be incomplete.
        Always consult a qualified healthcare provider before starting any supplement or drug protocol.
      </p>
    </div>
  )
}
