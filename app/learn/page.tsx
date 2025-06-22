import { LearningCenter } from "@/components/learning-center"
import { Navigation } from "@/components/navigation"

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <LearningCenter />
    </div>
  )
}
