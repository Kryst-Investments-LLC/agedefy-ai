"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react"

interface Measurement {
  id: string
  value: number
  unit: string
  target: number | null
  trend: string
  measuredAt: string
}

interface Analytics {
  count: number
  min: number
  max: number
  avg: number
  delta: number
  direction: string
  unit: string
  target: number | null
}

interface TrendsResponse {
  name: string
  measurements: Measurement[]
  analytics: Analytics | null
  availableNames: string[]
}

export function BiomarkerTrends() {
  const [names, setNames] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [data, setData] = useState<Record<string, TrendsResponse>>({})
  const [loading, setLoading] = useState(false)
  const [annotations, setAnnotations] = useState<Record<string, string>>({})

  // Load available biomarker names on mount
  useEffect(() => {
    fetch("/api/biomarkers/trends?name=_init_&months=1")
      .then((r) => r.json())
      .then((d: TrendsResponse) => {
        if (d.availableNames?.length) {
          setNames(d.availableNames)
          setSelected([d.availableNames[0]])
        }
      })
      .catch(() => {})
  }, [])

  const fetchTrends = useCallback(async (name: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/biomarkers/trends?name=${encodeURIComponent(name)}&months=12`)
      if (res.ok) {
        const result = await res.json()
        setData((prev) => ({ ...prev, [name]: result }))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    selected.forEach((name) => {
      if (!data[name]) fetchTrends(name)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  if (names.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Biomarker Trends</CardTitle>
          <CardDescription>Record at least 2 measurements of the same biomarker to see trend analytics.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Multi-biomarker overlay: merge all selected biomarker data by date
  const allDates = Array.from(new Set(selected.flatMap((n) => (data[n]?.measurements ?? []).map((m) => m.measuredAt)))).sort()
  const chartData = allDates.map((date) => {
    const entry: Record<string, string | number | null> = { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
    selected.forEach((n) => {
      const found = (data[n]?.measurements ?? []).find((m) => m.measuredAt === date)
      entry[n] = found ? found.value : null
    })
    return entry
  })

  // Export CSV
  const exportCSV = () => {
    const header = ["Date", ...selected]
    const rows = chartData.map((row) => [row.date, ...selected.map((n) => row[n] ?? "")])
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "biomarker-trends.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Annotation handler
  const handleAnnotation = (name: string, value: string) => {
    setAnnotations((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Biomarker Trends</CardTitle>
        <CardDescription>Longitudinal view of your tracked biomarkers. Overlay, annotate, and export trends.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Multi-select Name selector */}
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <Button
              key={n}
              variant={selected.includes(n) ? "default" : "outline"}
              size="sm"
              onClick={() => setSelected((cur) => cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n])}
            >
              {n}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCSV}>Export CSV</Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {/* Analytics summary for each selected biomarker */}
        {!loading && selected.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {selected.map((n) => {
              const analytics = data[n]?.analytics
              const DirectionIcon = analytics?.direction === "increasing" ? TrendingUp : analytics?.direction === "decreasing" ? TrendingDown : Minus
              return analytics ? (
                <div key={n} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{n}</span>
                    <DirectionIcon className="h-4 w-4" />
                    <Badge variant={analytics.direction === "increasing" ? "default" : analytics.direction === "decreasing" ? "destructive" : "secondary"}>{analytics.direction}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-lg font-semibold">{analytics.avg} <span className="text-xs text-muted-foreground">{analytics.unit}</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Range</p>
                      <p className="text-lg font-semibold">{analytics.min}–{analytics.max}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Delta</p>
                      <p className="text-lg font-semibold">{analytics.delta > 0 ? "+" : ""}{analytics.delta}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Readings</p>
                      <p className="text-lg font-semibold">{analytics.count}</p>
                    </div>
                  </div>
                  {analytics.target && (
                    <div className="mt-2 text-xs text-muted-foreground">Target: {analytics.target} {analytics.unit}</div>
                  )}
                  <div className="mt-2">
                    <textarea
                      className="w-full rounded border border-gray-700 bg-gray-900 p-1 text-xs text-white"
                      placeholder="Add annotation..."
                      value={annotations[n] ?? ""}
                      onChange={(e) => handleAnnotation(n, e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ) : null
            })}
          </div>
        )}

        {/* Multi-biomarker overlay chart */}
        {chartData.length >= 2 && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px" }}
                  labelStyle={{ color: "#888" }}
                />
                {selected.map((n, idx) => (
                  <Line key={n} type="monotone" dataKey={n} stroke={['#14b8a6', '#f59e42', '#e11d48', '#6366f1', '#fbbf24', '#10b981'][idx % 6]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
