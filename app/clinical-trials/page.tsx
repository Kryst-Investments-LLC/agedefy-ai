import { ClinicalTrials } from "@/components/clinical-trials"
import { Navigation } from "@/components/navigation"

export default function ClinicalTrialsPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <ClinicalTrials />
    </div>
  )
}
