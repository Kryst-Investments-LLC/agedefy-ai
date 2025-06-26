import { Navigation } from "@/components/navigation"
import { SubscriptionManagement } from "@/components/subscription-management"

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <SubscriptionManagement />
    </div>
  )
}
