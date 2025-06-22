import { AIPersonalization } from "@/components/ai-personalization"
import { Navigation } from "@/components/navigation"

export default function PersonalizationPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <AIPersonalization />
    </div>
  )
}
