"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { TrendingDown } from "lucide-react"

interface TimelinePoint {
  id: string
  biologicalAge: number
  chronologicalAge: number
  delta: number
  confidence: number
  createdAt: string
}

export function BioAgeTimeline() {
  const [data, setData] = useState<TimelinePoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/bio-age?limit=50")
      if (!res.ok) return
      const json = await res.json()
      // API returns newest first; chart needs chronological
      setData((json.snapshots as TimelinePoint[]).reverse())
    } catch {
      // silent — timeline is supplementary
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="h-48 bg-muted rounded" />
      </div>
    )
  }

  if (data.length < 2) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Bio-Age Timeline</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          At least two bio-age computations are needed to show a trend. Come
          back after your next assessment.
        </p>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    date: new Date(d.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    bioAge: d.biologicalAge,
    chronAge: d.chronologicalAge,
  }))

  const chronAge = data[0]?.chronologicalAge ?? 0

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Bio-Age Timeline</h3>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            domain={["dataMin - 3", "dataMax + 3"]}
            tick={{ fontSize: 12 }}
            label={{
              value: "Age (years)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
          />
          <Tooltip />
          <ReferenceLine
            y={chronAge}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: "Chronological", position: "right", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="bioAge"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Biological Age"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" /> Biological Age
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-400" /> Chronological
        </span>
      </div>
    </div>
  )
}
