import { SubscriptionManagement } from "@/components/subscription-management"
import { Navigation } from "@/components/navigation"

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <SubscriptionManagement />
    </div>
  )
}
