"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, MessageSquare, TrendingUp, Shield, Sparkles, Heart, Activity, Zap } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export default function AICoachPage() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState([
    {
      type: "ai",
      content: "Hello! I'm your AI Health Coach. I can help you with personalized health recommendations, longevity protocols, and answer questions about anti-aging research. What would you like to know?"
    }
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Brain className="h-12 w-12 text-teal-400 mr-3" />
              <h1 className="text-4xl font-bold text-white">{t('aiHealthCoach.title')}</h1>
              <Badge className="ml-3 bg-teal-600/20 text-teal-300 border-teal-500/20">AI</Badge>
            </div>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              {t('aiHealthCoach.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-red-400" />
                  Health Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">Get personalized health insights based on your biomarkers and lifestyle</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-green-400" />
                  Protocol Design
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">Custom longevity protocols tailored to your specific health goals</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Real-time Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">24/7 AI-powered health coaching and research-backed recommendations</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-400" />
                AI Health Coach Chat
              </CardTitle>
              <CardDescription className="text-gray-400">
                Ask me anything about longevity, health optimization, or anti-aging research
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700 min-h-[400px] flex flex-col">
                <div className="flex-1 space-y-4 mb-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('aiHealthCoach.askQuestion')}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    disabled={isLoading}
                  />
                  <Button 
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      "Send"
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze My Health Data
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Create Longevity Protocol
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Safety Check Supplements
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Latest Research Insights
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
