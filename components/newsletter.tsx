"use client"

import { Mail, CheckCircle, Zap, BookOpen, Users } from "lucide-react"
import type React from "react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function Newsletter() {
  const [email, setEmail] = useState("")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsSubscribed(true)
    setIsLoading(false)
    setEmail("")
  }

  return (
    <section className="py-20 bg-gradient-to-r from-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-white mb-4">Stay Ahead in Longevity Research</h2>
          <p className="text-xl text-gray-300 mb-6">
            Get weekly insights, safety updates, and breakthrough discoveries delivered to your inbox
          </p>

          <div className="flex justify-center gap-4 mb-8">
            <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">
              <Zap className="h-3 w-3 mr-1" />
              Weekly Updates
            </Badge>
            <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
              <BookOpen className="h-3 w-3 mr-1" />
              Research Summaries
            </Badge>
            <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
              <Users className="h-3 w-3 mr-1" />
              Community Highlights
            </Badge>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            {isSubscribed ? (
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Welcome to the Community!</h3>
                <p className="text-gray-300">
                  You'll receive your first longevity insights newsletter within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 px-8">
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Subscribing...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Subscribe
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-sm text-gray-400">
                  <p>Join 25,000+ longevity enthusiasts • No spam • Unsubscribe anytime</p>
                  <p className="mt-2">By subscribing, you agree to our Privacy Policy and Terms of Service</p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Newsletter Preview */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
            <Zap className="h-8 w-8 text-teal-400 mb-4" />
            <h3 className="text-white font-semibold mb-2">Weekly Research Digest</h3>
            <p className="text-gray-400 text-sm">
              Latest studies, breakthrough discoveries, and safety updates in longevity research
            </p>
          </div>

          <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
            <BookOpen className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-white font-semibold mb-2">Educational Content</h3>
            <p className="text-gray-400 text-sm">
              Simple explanations of complex topics, beginner guides, and expert interviews
            </p>
          </div>

          <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
            <Users className="h-8 w-8 text-purple-400 mb-4" />
            <h3 className="text-white font-semibold mb-2">Community Insights</h3>
            <p className="text-gray-400 text-sm">
              User experiences, success stories, and discussions from our global community
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
