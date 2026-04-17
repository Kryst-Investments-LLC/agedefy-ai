/**
 * Biomarker Predictive Analytics Engine
 *
 * Uses linear regression over a user's biomarker time series to forecast
 * future values with confidence intervals.
 */

export interface BiomarkerDataPoint {
  value: number
  measuredAt: Date
}

export interface BiomarkerPrediction {
  biomarkerName: string
  unit: string
  currentValue: number
  predictions: Array<{
    daysOut: number
    predictedValue: number
    confidenceLow: number
    confidenceHigh: number
  }>
  trend: "improving" | "declining" | "stable"
  trendSlope: number
  r2: number
  dataPointCount: number
}

function linearRegression(points: Array<{ x: number; y: number }>) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // R² (coefficient of determination)
  const yMean = sumY / n
  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - yMean) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { slope, intercept, r2 }
}

function standardError(
  points: Array<{ x: number; y: number }>,
  slope: number,
  intercept: number,
) {
  const n = points.length
  if (n < 3) return 0

  let ssRes = 0
  for (const p of points) {
    ssRes += (p.y - (slope * p.x + intercept)) ** 2
  }
  return Math.sqrt(ssRes / (n - 2))
}

const FORECAST_DAYS = [30, 60, 90] as const

export function predictBiomarker(
  name: string,
  unit: string,
  dataPoints: BiomarkerDataPoint[],
): BiomarkerPrediction | null {
  if (dataPoints.length < 3) return null

  const sorted = [...dataPoints].sort(
    (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
  )

  const baseTime = sorted[0].measuredAt.getTime()
  const points = sorted.map((dp) => ({
    x: (dp.measuredAt.getTime() - baseTime) / (1000 * 60 * 60 * 24), // days from first
    y: dp.value,
  }))

  const { slope, intercept, r2 } = linearRegression(points)
  const se = standardError(points, slope, intercept)

  const lastPoint = points[points.length - 1]
  const nowDays = lastPoint.x
  const tConfidence95 = 1.96 // approximate for large-ish n

  const predictions = FORECAST_DAYS.map((daysOut) => {
    const futureX = nowDays + daysOut
    const predicted = slope * futureX + intercept
    const margin = tConfidence95 * se * Math.sqrt(1 + 1 / points.length)
    return {
      daysOut,
      predictedValue: Math.round(predicted * 100) / 100,
      confidenceLow: Math.round((predicted - margin) * 100) / 100,
      confidenceHigh: Math.round((predicted + margin) * 100) / 100,
    }
  })

  // Determine trend direction
  // Slope normalized by the mean value to get a percentage change per day
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length
  const dailyChangePercent = meanY !== 0 ? (slope / meanY) * 100 : 0
  const trend: BiomarkerPrediction["trend"] =
    Math.abs(dailyChangePercent) < 0.05
      ? "stable"
      : dailyChangePercent > 0
        ? "improving"
        : "declining"

  return {
    biomarkerName: name,
    unit,
    currentValue: sorted[sorted.length - 1].value,
    predictions,
    trend,
    trendSlope: Math.round(slope * 10000) / 10000,
    r2: Math.round(r2 * 1000) / 1000,
    dataPointCount: dataPoints.length,
  }
}
