import React from "react"
import { PersonalizedMedicinePlans } from "@/components/personalized-medicine-plans"
import { Navigation } from "@/components/navigation"

export default function PersonalizedMedicinePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <PersonalizedMedicinePlans />
      </div>
    </div>
  )
}
