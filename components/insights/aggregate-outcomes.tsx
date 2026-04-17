"use client"

import { useCallback, useEffect, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface AggregateOutcomeData {
  id: string
  protocolId?: string | null
  compoundId?: string | null
  cohortBucket: string
  sampleSize: number
  meanOutcomeScore: number
  stdDev: number
  pValue?: number | null
  confidence: number
  period: string
  computedAt: string
  protocol?: { id: string; name: string } | null
  compound?: { id: string; name: string; category: string } | null
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AggregateOutcomeCards() {
  const [aggregates, setAggregates] = useState<AggregateOutcomeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAggregates = useCallback(async () => {
    try {
      const res = await fetch("/api/insights/aggregate?limit=20")
      if (!res.ok) throw new Error("Failed to load insights")
      const data = await res.json()
      setAggregates(data.aggregates ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAggregates()
  }, [fetchAggregates])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading population insights…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (aggregates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No population insights available yet. Data will appear once enough
          anonymised outcomes have been aggregated.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {aggregates.map((agg) => (
        <AggregateCard key={agg.id} data={agg} />
      ))}
    </div>
  )
}

function AggregateCard({ data }: { data: AggregateOutcomeData }) {
  const label = data.protocol?.name
    ?? data.compound?.name
    ?? data.cohortBucket

  const scoreColor =
    data.meanOutcomeScore > 0
      ? "text-green-600 dark:text-green-400"
      : data.meanOutcomeScore < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

  const scoreSign = data.meanOutcomeScore > 0 ? "+" : ""
  const isPreliminary = data.sampleSize < 30

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {data.cohortBucket !== "all" && (
            <span className="mr-2 text-xs bg-muted px-1.5 py-0.5 rounded">
              {data.cohortBucket}
            </span>
          )}
          <span className="text-xs">Period: {data.period}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {scoreSign}{data.meanOutcomeScore.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">mean outcome</span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>n={data.sampleSize}</span>
          <span>σ={data.stdDev.toFixed(2)}</span>
          {data.pValue != null && (
            <span>p={data.pValue.toFixed(3)}</span>
          )}
        </div>

        {isPreliminary && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠ Preliminary — sample size below 30
          </p>
        )}

        <div className="mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
          🔒 k-anonymity (k≥5) + differential privacy applied
        </div>
      </CardContent>
    </Card>
  )
}
