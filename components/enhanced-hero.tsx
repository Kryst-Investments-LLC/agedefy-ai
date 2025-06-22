"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Play, Shield, Users, Zap, Brain, Stethoscope, ShoppingCart, Microscope, Award } from "lucide-react"
import Link from "next/link"

export function EnhancedHero() {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [particles, setParticles] = useState<Array<{left: string, top: string, delay: string, duration: string}>>([])

  const features = [
    { icon: Shield, text: "Safety-First Approach" },
    { icon: Users, text: "50K+ Community" },
    { icon: Zap, text: "AI-Powered Insights" },
    { icon: Brain, text: "Personalized Protocols" },
    { icon: Stethoscope, text: "Medical Supervision" },
    { icon: ShoppingCart, text: "Verified Marketplace" },
    { icon: Microscope, text: "Advanced Lab Testing" },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const generatedParticles = [...Array(30)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${2 + Math.random() * 3}s`,
    }))
    setParticles(generatedParticles)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 overflow-hidden">
      {/* Enhanced animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-teal-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-purple-500 rounded-full blur-2xl animate-pulse delay-2000"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-teal-400 rounded-full opacity-30 animate-pulse"
            style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
        <div className="mb-8">
          {/* Enhanced trust indicators */}
          <div className="flex justify-center items-center gap-6 mb-6 text-sm text-gray-400 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-400" />
              <span>Medical Grade</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span>50K+ Users</span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-purple-400" />
              <span>Doctor Supervised</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-400" />
              <span>Research Backed</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            The Complete{" "}
            <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
              Longevity Ecosystem
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-4xl mx-auto">
            <span className="bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent font-semibold">
              AI Ensemble Intelligence
            </span>{" "}
            powered by OpenAI, Grok & Anthropic - medical supervision, verified compounds, and advanced testing
          </p>

          <p className="text-lg text-gray-400 mb-8 max-w-3xl mx-auto">
            From beginner-friendly education to cutting-edge clinical trials - your complete journey to optimal
            healthspan
          </p>

          {/* Enhanced rotating feature highlight */}
          <div className="mb-8 h-8">
            <div className="flex items-center justify-center gap-2 text-teal-400 font-medium">
              {features[currentFeature] && React.createElement(features[currentFeature].icon, { className: "h-5 w-5" })}
              <span>{features[currentFeature]?.text}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link href="/personalization">
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Get Your AI Protocol
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button
              variant="outline"
              size="lg"
              className="border-teal-400 text-teal-400 hover:bg-teal-400 hover:text-gray-900 px-8 py-4 text-lg transition-all duration-300"
            >
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </Link>
        </div>

        {/* Enhanced platform overview */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 max-w-5xl mx-auto border border-teal-500/20 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-teal-600 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-teal-400 font-semibold mb-2">AI Ensemble Intelligence</h3>
              <p className="text-gray-300 text-sm">Multi-AI system combining OpenAI, Grok & Anthropic for superior insights</p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-blue-400 font-semibold mb-2">Medical Supervision</h3>
              <p className="text-gray-300 text-sm">Board-certified longevity doctors guide your journey</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-600 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                <Microscope className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-purple-400 font-semibold mb-2">Advanced Testing</h3>
              <p className="text-gray-300 text-sm">Comprehensive biomarker analysis with AI interpretation</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex flex-wrap justify-center gap-3">
              <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
                AI Ensemble Intelligence
              </Badge>
              <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">Research-Grade Quality</Badge>
              <Badge className="bg-green-600/20 text-green-300 border-green-500/20">FDA Compliant</Badge>
              <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">Clinical Trial Access</Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
