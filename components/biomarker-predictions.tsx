"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MedicalDisclaimer } from "@/components/medical-disclaimer"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { BiomarkerPrediction } from "@/lib/analytics/biomarker-prediction"

interface BiomarkerPredictionsProps {
  predictions: BiomarkerPrediction[]
}

const trendConfig = {
  improving: { label: "Improving", color: "text-green-600 dark:text-green-400", icon: TrendingUp, badge: "bg-green-600/20 text-green-700 dark:text-green-300 border-green-500/20" },
  declining: { label: "Declining", color: "text-red-600 dark:text-red-400", icon: TrendingDown, badge: "bg-red-600/20 text-red-700 dark:text-red-300 border-red-500/20" },
  stable: { label: "Stable", color: "text-muted-foreground", icon: Minus, badge: "bg-gray-600/20 text-muted-foreground border-gray-500/20" },
} as const

export function BiomarkerPredictions({ predictions }: BiomarkerPredictionsProps) {
  if (predictions.length === 0) {
    return (
      <Card className="border-border bg-background">
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">
            Not enough biomarker data for predictions. At least 3 data points per biomarker are required.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {predictions.map((pred) => {
        const trend = trendConfig[pred.trend]
        const TrendIcon = trend.icon
        return (
          <Card key={pred.biomarkerName} className="border-border bg-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-foreground">
                  {pred.biomarkerName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={trend.badge}>
                    <TrendIcon className="h-3 w-3 mr-1" />
                    {trend.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    R² {pred.r2} · {pred.dataPointCount} pts
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-3">
                <span className="text-2xl font-bold text-foreground">
                  {pred.currentValue}
                </span>
                <span className="text-sm text-muted-foreground ml-1">{pred.unit}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {pred.predictions.map((p) => (
                  <div
                    key={p.daysOut}
                    className="rounded-md bg-card px-3 py-2 text-center"
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {p.daysOut}d forecast
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {p.predictedValue}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.confidenceLow}–{p.confidenceHigh}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
      <MedicalDisclaimer variant="compact" />
    </div>
  )
}
