import React from "react"
import { GenomicEpigenomicAnalysis } from "@/components/genomic-epigenomic-analysis"
import { Navigation } from "@/components/navigation"

export default function GenomicAnalysisPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <GenomicEpigenomicAnalysis />
      </div>
    </div>
  )
}
