import { Navigation } from "@/components/navigation"
import { UserDashboard } from "@/components/user-dashboard"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <UserDashboard />
    </div>
  )
}
