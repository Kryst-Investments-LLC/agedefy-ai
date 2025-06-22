import { Marketplace } from "@/components/marketplace"
import { Navigation } from "@/components/navigation"

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <Marketplace />
    </div>
  )
}
