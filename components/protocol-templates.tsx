"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookTemplate, Check, Loader2, AlertTriangle } from "lucide-react"

interface Template {
  id: string
  name: string
  description: string
  category: string
  compounds: { name: string; category: string; mechanism: string | null }[]
  targetPathways: string[]
  biomarkerTargets: string[]
  evidence: string
  caution: string
}

export function ProtocolTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [adopting, setAdopting] = useState<string | null>(null)
  const [adopted, setAdopted] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/protocols/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const adopt = async (t: Template) => {
    setAdopting(t.id)
    try {
      const res = await fetch("/api/protocols/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: t.id,
          templateName: t.name,
          templateDescription: `${t.description}\n\nCompounds: ${t.compounds.map((c) => c.name).join(", ")}\nEvidence: ${t.evidence}`,
        }),
      })
      if (res.ok) {
        setAdopted((prev) => new Set(prev).add(t.id))
      }
    } finally {
      setAdopting(null)
    }
  }

  if (loading) return null

  if (templates.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookTemplate className="h-5 w-5" /> Research-Informed Protocol Templates
        </CardTitle>
        <CardDescription>
          Curated protocol starters assembled from the knowledge graph and source studies. Review the evidence and cautions before adopting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold">{t.name}</span>
                  <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
              <Button
                variant={adopted.has(t.id) ? "outline" : "default"}
                size="sm"
                onClick={() => adopt(t)}
                disabled={adopting === t.id || adopted.has(t.id)}
                className="shrink-0"
              >
                {adopting === t.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : adopted.has(t.id) ? (
                  <><Check className="h-4 w-4 mr-1" /> Adopted</>
                ) : (
                  "Adopt"
                )}
              </Button>
            </div>

            {/* Compounds */}
            <div className="flex flex-wrap gap-1">
              {t.compounds.map((c) => (
                <Badge key={c.name} variant="outline" className="text-xs">
                  {c.name}
                </Badge>
              ))}
            </div>

            {/* Pathways */}
            {t.targetPathways.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.targetPathways.map((p) => (
                  <Badge key={p} className="bg-teal-600/20 text-teal-700 dark:text-teal-300 border-teal-500/20 text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            )}

            {/* Biomarker targets */}
            {t.biomarkerTargets.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.biomarkerTargets.map((b, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                ))}
              </div>
            )}

            {/* Evidence + Caution */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Evidence:</strong> {t.evidence}</p>
              <p className="flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-yellow-500" />
                {t.caution}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
