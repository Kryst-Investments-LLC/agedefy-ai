import React from "react"
import { BlockchainDataSecurity } from "@/components/blockchain-data-security"
import { Navigation } from "@/components/navigation"

export default function BlockchainSecurityPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <BlockchainDataSecurity />
      </div>
    </div>
  )
}
