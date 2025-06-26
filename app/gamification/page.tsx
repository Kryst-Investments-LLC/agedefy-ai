import React from "react"

import { Gamification } from "@/components/gamification"
import { Navigation } from "@/components/navigation"

export default function GamificationPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <Gamification />
      </div>
    </div>
  )
}
