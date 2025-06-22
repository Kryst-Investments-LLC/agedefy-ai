"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Users, BookOpen, Shield } from "lucide-react"

const stats = [
  {
    icon: Users,
    value: 50000,
    label: "Active Users",
    suffix: "+",
    description: "Researchers and enthusiasts worldwide",
  },
  {
    icon: BookOpen,
    value: 15000,
    label: "Research Papers",
    suffix: "+",
    description: "Analyzed and summarized by AI",
  },
  {
    icon: TrendingUp,
    value: 98,
    label: "Safety Score",
    suffix: "%",
    description: "User satisfaction with safety features",
  },
  {
    icon: Shield,
    value: 24,
    label: "Safety Checks",
    suffix: "/7",
    description: "Continuous monitoring and updates",
  },
]

export function Stats() {
  const [counters, setCounters] = useState(stats.map(() => 0))

  useEffect(() => {
    const intervals = stats.map((stat, index) => {
      const increment = stat.value / 100
      return setInterval(() => {
        setCounters((prev) => {
          const newCounters = [...prev]
          if (newCounters[index] < stat.value) {
            newCounters[index] = Math.min(newCounters[index] + increment, stat.value)
          }
          return newCounters
        })
      }, 20)
    })

    return () => intervals.forEach(clearInterval)
  }, [])

  return (
    <section className="py-20 bg-gray-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Trusted by the Longevity Community</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Join thousands of users who trust our platform for safe, evidence-based anti-aging research
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300 group"
            >
              <CardContent className="p-6 text-center">
                <div className="bg-teal-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-500 transition-colors">
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {Math.floor(counters[index]).toLocaleString()}
                  {stat.suffix}
                </div>
                <div className="text-teal-400 font-medium mb-2">{stat.label}</div>
                <div className="text-gray-400 text-sm">{stat.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
