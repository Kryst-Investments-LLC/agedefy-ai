"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const testimonials = [
  {
    name: "Dr. Sarah Chen",
    role: "Longevity Researcher",
    location: "Stanford University",
    content:
      "AgeDefy AI has revolutionized how I approach compound research. The AI predictions are remarkably accurate, and the safety analysis is comprehensive. It's become an essential tool in my lab.",
    rating: 5,
    verified: true,
    category: "Researcher",
    compound: "NMN + Resveratrol",
    result: "95% prediction accuracy",
  },
  {
    name: "Michael Rodriguez",
    role: "Biohacker & Entrepreneur",
    location: "San Francisco, CA",
    content:
      "As someone new to anti-aging, the educational content is incredible. The app explains complex science in simple terms and the safety warnings helped me avoid dangerous combinations.",
    rating: 5,
    verified: true,
    category: "Beginner",
    compound: "Quercetin + Curcumin",
    result: "Improved biomarkers",
  },
  {
    name: "Dr. James Wilson",
    role: "Functional Medicine Physician",
    location: "New York, NY",
    content:
      "I recommend this platform to my patients interested in longevity. The evidence-based approach and comprehensive safety profiles give me confidence in the recommendations.",
    rating: 5,
    verified: true,
    category: "Medical Professional",
    compound: "Spermidine Protocol",
    result: "Patient compliance up 80%",
  },
  {
    name: "Lisa Thompson",
    role: "Health Coach",
    location: "Austin, TX",
    content:
      "The community aspect is fantastic. I've learned so much from other users' experiences, and the moderated forums ensure quality discussions about safety and effectiveness.",
    rating: 5,
    verified: true,
    category: "Health Professional",
    compound: "Fisetin + Quercetin",
    result: "Enhanced client outcomes",
  },
  {
    name: "Robert Kim",
    role: "Retired Engineer",
    location: "Seattle, WA",
    content:
      "At 68, I was skeptical about supplements. This app's scientific approach and clear explanations convinced me. My energy levels have improved significantly with their recommended protocol.",
    rating: 5,
    verified: true,
    category: "Senior User",
    compound: "NAD+ Boosting Stack",
    result: "40% energy increase",
  },
  {
    name: "Dr. Maria Gonzalez",
    role: "Biochemist",
    location: "Barcelona, Spain",
    content:
      "The research integration is outstanding. Having 15,000+ papers analyzed and summarized saves me hours of literature review. The AI insights often reveal connections I missed.",
    rating: 5,
    verified: true,
    category: "Researcher",
    compound: "Multi-compound Analysis",
    result: "3x faster research",
  },
]

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    setIsAutoPlaying(false)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
    setIsAutoPlaying(false)
  }

  const currentTestimonial = testimonials[currentIndex]

  return (
    <section className="py-20 bg-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Trusted by Longevity Experts Worldwide</h2>
          <p className="text-xl text-gray-400 mb-8">
            From researchers to beginners, see how AgeDefy AI is transforming anti-aging research
          </p>
          <div className="flex justify-center gap-2">
            <Badge className="bg-green-600/20 text-green-300 border-green-500/20">50,000+ Active Users</Badge>
            <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">98% Satisfaction Rate</Badge>
            <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
              Medical Professional Approved
            </Badge>
          </div>
        </div>

        {/* Main Testimonial */}
        <div className="relative mb-12">
          <Card className="bg-gray-700 border-gray-600 max-w-4xl mx-auto">
            <CardContent className="p-8">
              <div className="flex items-start gap-6">
                <Quote className="h-12 w-12 text-teal-400 flex-shrink-0 opacity-50" />
                <div className="flex-1">
                  <div className="flex mb-4">
                    {[...Array(currentTestimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>

                  <p className="text-gray-300 text-lg leading-relaxed mb-6 italic">"{currentTestimonial.content}"</p>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold">{currentTestimonial.name}</p>
                          {currentTestimonial.verified && (
                            <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20 text-xs">Verified</Badge>
                          )}
                        </div>
                        <p className="text-teal-400 text-sm">{currentTestimonial.role}</p>
                        <p className="text-gray-500 text-sm">{currentTestimonial.location}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20 mb-1">
                        {currentTestimonial.category}
                      </Badge>
                      <p className="text-gray-400 text-sm">{currentTestimonial.compound}</p>
                      <p className="text-green-400 text-sm font-medium">{currentTestimonial.result}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={prevTestimonial}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index)
                    setIsAutoPlaying(false)
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? "bg-teal-400" : "bg-gray-600"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={nextTestimonial}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Testimonial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <Card
              key={index}
              className="bg-gray-700 border-gray-600 hover:border-teal-500/50 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-4 italic line-clamp-3">"{testimonial.content}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{testimonial.name}</p>
                    <p className="text-teal-400 text-xs">{testimonial.role}</p>
                  </div>
                  <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20 text-xs">
                    {testimonial.category}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-teal-400 mb-2">50K+</div>
              <div className="text-gray-400 text-sm">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400 mb-2">98%</div>
              <div className="text-gray-400 text-sm">Satisfaction Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400 mb-2">500+</div>
              <div className="text-gray-400 text-sm">Medical Professionals</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400 mb-2">15K+</div>
              <div className="text-gray-400 text-sm">Research Papers</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
