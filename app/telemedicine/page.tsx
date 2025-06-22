import { TelemedicineIntegration } from "@/components/telemedicine-integration"
import { Navigation } from "@/components/navigation"

export default function TelemedicinePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <TelemedicineIntegration />
    </div>
  )
}
