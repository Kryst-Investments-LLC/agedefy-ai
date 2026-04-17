"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MedicalDisclaimer } from "@/components/medical-disclaimer"
import { FlaskConical, TestTube, ClipboardList, BookOpen } from "lucide-react"
import type { Recommendation } from "@/lib/analytics/recommendations"

interface DynamicRecommendationsProps {
  recommendations: Recommendation[]
}

const typeConfig = {
  compound: { icon: FlaskConical, label: "Compound", badge: "bg-purple-600/20 text-purple-300 border-purple-500/20" },
  protocol_adjustment: { icon: ClipboardList, label: "Protocol", badge: "bg-amber-600/20 text-amber-300 border-amber-500/20" },
  lab_panel: { icon: TestTube, label: "Lab Panel", badge: "bg-blue-600/20 text-blue-300 border-blue-500/20" },
  research: { icon: BookOpen, label: "Research", badge: "bg-teal-600/20 text-teal-300 border-teal-500/20" },
} as const

const qualityColors = {
  high: "bg-green-600/20 text-green-300 border-green-500/20",
  moderate: "bg-yellow-600/20 text-yellow-300 border-yellow-500/20",
  low: "bg-gray-600/20 text-gray-300 border-gray-500/20",
} as const

export function DynamicRecommendations({ recommendations }: DynamicRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card className="border-gray-700 bg-gray-900">
        <CardContent className="p-6">
          <p className="text-gray-400 text-sm">
            No recommendations available yet. Add biomarker readings and protocols to receive personalized insights.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, i) => {
        const config = typeConfig[rec.type]
        const Icon = config.icon
        return (
          <Card key={`${rec.type}-${rec.title}-${i}`} className="border-gray-700 bg-gray-900">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 rounded-md bg-gray-800 p-2">
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {rec.title}
                    </h4>
                    <Badge className={config.badge + " text-xs"}>
                      {config.label}
                    </Badge>
                    <Badge className={qualityColors[rec.evidenceQuality] + " text-xs"}>
                      {rec.evidenceQuality} evidence
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {rec.reason}
                  </p>
                  {rec.relatedPathway && (
                    <p className="text-xs text-gray-500 mt-1">
                      Pathway: {rec.relatedPathway}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-gray-500">Relevance</div>
                  <div className="text-sm font-bold text-teal-400">
                    {Math.round(rec.relevanceScore * 100)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
      <MedicalDisclaimer variant="banner" className="mt-4" />
    </div>
  )
}
