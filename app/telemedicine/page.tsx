import { Navigation } from "@/components/navigation"
import { TelemedicineIntegration } from "@/components/telemedicine-integration"

export default function TelemedicinePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <TelemedicineIntegration />
    </div>
  )
}
