import React from "react"
import { UserGeneratedContent } from "@/components/user-generated-content"
import { Navigation } from "@/components/navigation"

export default function UserContentPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <UserGeneratedContent />
      </div>
    </div>
  )
}
