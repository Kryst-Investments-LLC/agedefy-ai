import { PricingPlans } from "@/components/pricing-plans"
import { Navigation } from "@/components/navigation"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <PricingPlans />
    </div>
  )
}
