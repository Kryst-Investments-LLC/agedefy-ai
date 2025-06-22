import { UserDashboard } from "@/components/user-dashboard"
import { Navigation } from "@/components/navigation"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <UserDashboard />
    </div>
  )
}
