"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Shield, Users, Zap } from "lucide-react"
import Link from "next/link"

export function Hero() {
  const [currentFeature, setCurrentFeature] = useState(0)

  const features = [
    { icon: Shield, text: "Safety-First Approach" },
    { icon: Users, text: "Beginner Friendly" },
    { icon: Zap, text: "AI-Powered Insights" },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 3000)
    return () => clearInterval(interval)
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
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-teal-400 rounded-full opacity-30 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
        <div className="mb-8">
          {/* Trust indicators */}
          <div className="flex justify-center items-center gap-6 mb-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-400" />
              <span>FDA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span>50K+ Users</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span>AI-Powered</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Defy Aging with{" "}
            <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
              AI-Powered Insights
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-4xl mx-auto">
            The world's most advanced anti-aging research platform - designed for everyone from beginners to experts
          </p>

          <p className="text-lg text-gray-400 mb-8 max-w-3xl mx-auto">
            Discover safe compound combinations, understand complex research, and make informed decisions about your
            longevity journey
          </p>

          {/* Rotating feature highlight */}
          <div className="mb-8 h-8">
            <div className="flex items-center justify-center gap-2 text-teal-400 font-medium">
              {features[currentFeature] && React.createElement(features[currentFeature].icon, { className: "h-5 w-5" })}
              <span>{features[currentFeature]?.text}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link href="/mixer">
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Start Your Journey
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

        {/* Enhanced educational note */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 max-w-3xl mx-auto border border-teal-500/20 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="bg-teal-600 rounded-full p-2 flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-teal-400 font-semibold mb-2">New to Anti-Aging Research?</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Our platform explains everything in simple terms, provides comprehensive safety warnings, and helps you
                understand the science behind longevity compounds. No PhD required - just curiosity about living
                healthier, longer!
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="bg-teal-600/20 text-teal-300 px-2 py-1 rounded text-xs">Beginner Friendly</span>
                <span className="bg-blue-600/20 text-blue-300 px-2 py-1 rounded text-xs">Safety First</span>
                <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded text-xs">Expert Approved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
