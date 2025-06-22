"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cookie, Settings } from "lucide-react"

export function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem("agedefy-cookie-consent")
    if (!consent) {
      setShowConsent(true)
    }
  }, [])

  const acceptAll = () => {
    localStorage.setItem("agedefy-cookie-consent", "all")
    setShowConsent(false)
  }

  const acceptEssential = () => {
    localStorage.setItem("agedefy-cookie-consent", "essential")
    setShowConsent(false)
  }

  if (!showConsent) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Card className="bg-gray-800 border-gray-700 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Cookie className="h-6 w-6 text-teal-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-white font-semibold mb-2">Cookie Preferences</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                We use cookies to enhance your experience, provide personalized content, and analyze our traffic. Your
                privacy is important to us.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-green-600/20 text-green-300 border-green-500/20 text-xs">Essential</Badge>
            <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20 text-xs">Analytics</Badge>
            <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20 text-xs">Personalization</Badge>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button onClick={acceptAll} className="bg-teal-600 hover:bg-teal-700 flex-1 text-sm">
                Accept All
              </Button>
              <Button
                onClick={acceptEssential}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700 flex-1 text-sm"
              >
                Essential Only
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-white text-sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              Customize Settings
            </Button>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Essential Cookies</span>
                <Badge className="bg-green-600/20 text-green-300 border-green-500/20 text-xs">Required</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Analytics Cookies</span>
                <input type="checkbox" className="rounded" defaultChecked />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Personalization</span>
                <input type="checkbox" className="rounded" defaultChecked />
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            Learn more in our{" "}
            <a href="/privacy" className="text-teal-400 hover:underline">
              Privacy Policy
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
