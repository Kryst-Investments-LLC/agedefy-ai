import React from "react"

import { IoTDeviceIntegration } from "@/components/iot-device-integration"
import { Navigation } from "@/components/navigation"

export default function IoTIntegrationPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <IoTDeviceIntegration />
      </div>
    </div>
  )
}
