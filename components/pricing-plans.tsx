"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Check,
  X,
  Crown,
  Zap,
  Shield,
  Star,
  Users,
  Microscope,
  Brain,
  Stethoscope,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react"

const pricingPlans = [
  {
    id: "free",
    name: "Explorer",
    description: "Perfect for getting started with longevity optimization",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Shield,
    color: "gray",
    popular: false,
    features: {
      included: [
        "Basic compound mixer (5 compounds)",
        "Research paper access (10/month)",
        "Community forum access",
        "Basic safety warnings",
        "Educational content library",
        "Weekly newsletter",
      ],
      excluded: [
        "AI personalization",
        "Biomarker tracking",
        "Medical consultations",
        "Lab testing discounts",
        "Clinical trial access",
        "Premium compounds",
        "Advanced analytics",
        "Priority support",
      ],
    },
    cta: "Start Free",
    limits: {
      compounds: 5,
      research: "10 papers/month",
      support: "Community only",
      features: "Basic",
    },
  },
  {
    id: "premium",
    name: "Optimizer",
    description: "Advanced tools for serious longevity enthusiasts",
    monthlyPrice: 49,
    yearlyPrice: 490, // 2 months free
    icon: Zap,
    color: "blue",
    popular: true,
    features: {
      included: [
        "Full compound mixer (unlimited)",
        "Unlimited research access",
        "AI-powered personalization",
        "Biomarker tracking dashboard",
        "Community + expert forums",
        "Lab testing (20% discount)",
        "Wearable device integration",
        "Advanced safety monitoring",
        "Personalized protocols",
        "Monthly progress reports",
        "Email support",
      ],
      excluded: [
        "Medical consultations",
        "Clinical trial priority",
        "Marketplace discounts",
        "Custom genetic analysis",
        "Phone support",
        "Concierge services",
      ],
    },
    cta: "Start Optimizing",
    limits: {
      compounds: "Unlimited",
      research: "Unlimited",
      support: "Email + Community",
      features: "Advanced",
    },
  },
  {
    id: "professional",
    name: "Researcher",
    description: "Complete research platform with medical supervision",
    monthlyPrice: 149,
    yearlyPrice: 1490, // 2 months free
    icon: Microscope,
    color: "purple",
    popular: false,
    features: {
      included: [
        "Everything in Optimizer",
        "Monthly telemedicine consultations",
        "Priority clinical trial access",
        "Advanced genetic analysis",
        "Custom research protocols",
        "Marketplace (15% discount)",
        "Lab testing (30% discount)",
        "AI research assistant",
        "Data export & API access",
        "Priority support (phone + email)",
        "Quarterly health reports",
        "Research collaboration tools",
      ],
      excluded: [
        "Unlimited consultations",
        "Concierge lab coordination",
        "Custom supplement formulation",
        "White-glove onboarding",
      ],
    },
    cta: "Start Research",
    limits: {
      compounds: "Unlimited",
      research: "Unlimited + API",
      support: "Phone + Email",
      features: "Professional",
    },
  },
  {
    id: "elite",
    name: "Longevity Elite",
    description: "Ultimate longevity optimization with concierge service",
    monthlyPrice: 499,
    yearlyPrice: 4990, // 2 months free
    icon: Crown,
    color: "gold",
    popular: false,
    features: {
      included: [
        "Everything in Researcher",
        "Unlimited telemedicine consultations",
        "Dedicated longevity physician",
        "Concierge lab coordination",
        "Custom supplement formulation",
        "VIP clinical trial access",
        "Advanced epigenetic testing",
        "Personalized research studies",
        "White-glove onboarding",
        "24/7 priority support",
        "Quarterly in-person consultations",
        "Custom protocol development",
        "Executive health assessments",
      ],
      excluded: [],
    },
    cta: "Join Elite",
    limits: {
      compounds: "Unlimited + Custom",
      research: "Unlimited + Custom Studies",
      support: "24/7 Concierge",
      features: "Elite",
    },
  },
]

const addOnServices = [
  {
    id: "genetic-analysis",
    name: "Complete Genetic Analysis",
    description: "Comprehensive genetic testing for longevity optimization",
    price: 299,
    icon: Brain,
    features: ["ApoE, MTHFR, COMT variants", "Personalized supplement recommendations", "Disease risk assessment"],
  },
  {
    id: "epigenetic-testing",
    name: "Epigenetic Age Testing",
    description: "Determine your biological age with advanced DNA methylation analysis",
    price: 399,
    icon: TrendingUp,
    features: ["Biological age calculation", "Age acceleration analysis", "Lifestyle impact assessment"],
  },
  {
    id: "executive-physical",
    name: "Executive Longevity Physical",
    description: "Comprehensive in-person health assessment",
    price: 1299,
    icon: Stethoscope,
    features: ["Full body imaging", "Advanced biomarker panel", "Same-day results", "Doctor consultation"],
  },
  {
    id: "custom-formulation",
    name: "Custom Supplement Formulation",
    description: "Personalized supplement blend based on your genetics and biomarkers",
    price: 199,
    icon: Sparkles,
    features: ["Genetic-based formulation", "Third-party tested", "Monthly supply", "Dosing optimization"],
  },
]

const enterprisePlans = [
  {
    id: "clinic",
    name: "Longevity Clinic",
    description: "Complete platform for longevity clinics and practitioners",
    price: "Custom",
    icon: Stethoscope,
    features: [
      "Multi-practitioner dashboard",
      "Patient management system",
      "Billing integration",
      "Custom branding",
      "API access",
      "Training & support",
    ],
  },
  {
    id: "research",
    name: "Research Institution",
    description: "Advanced tools for academic and commercial research",
    price: "Custom",
    icon: Microscope,
    features: [
      "Unlimited participants",
      "Advanced analytics",
      "Data export tools",
      "IRB compliance tools",
      "Custom integrations",
      "Dedicated support",
    ],
  },
]

export function PricingPlans() {
  const [isYearly, setIsYearly] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const getColorClasses = (color: string, selected = false) => {
    const colors = {
      gray: selected ? "border-gray-400 bg-gray-800" : "border-gray-700 hover:border-gray-600",
      blue: selected ? "border-blue-400 bg-blue-900/20" : "border-blue-500/50 hover:border-blue-400",
      purple: selected ? "border-purple-400 bg-purple-900/20" : "border-purple-500/50 hover:border-purple-400",
      gold: selected ? "border-yellow-400 bg-yellow-900/20" : "border-yellow-500/50 hover:border-yellow-400",
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const getButtonClasses = (color: string) => {
    const colors = {
      gray: "bg-gray-600 hover:bg-gray-700",
      blue: "bg-blue-600 hover:bg-blue-700",
      purple: "bg-purple-600 hover:bg-purple-700",
      gold: "bg-yellow-600 hover:bg-yellow-700",
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const getPrice = (plan: any) => {
    if (plan.monthlyPrice === 0) return "Free"
    const price = isYearly ? plan.yearlyPrice / 12 : plan.monthlyPrice
    return `$${Math.round(price)}`
  }

  const getSavings = (plan: any) => {
    if (plan.monthlyPrice === 0) return null
    const monthlyCost = plan.monthlyPrice * 12
    const savings = monthlyCost - plan.yearlyPrice
    return savings
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">Choose Your Longevity Journey</h1>
        <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
          From basic optimization to elite concierge service - find the perfect plan to extend your healthspan and
          unlock your longevity potential
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-lg ${!isYearly ? "text-white font-semibold" : "text-gray-400"}`}>Monthly</span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} className="data-[state=checked]:bg-teal-600" />
          <span className={`text-lg ${isYearly ? "text-white font-semibold" : "text-gray-400"}`}>
            Yearly
            <Badge className="ml-2 bg-green-600/20 text-green-300 border-green-500/20">Save up to 17%</Badge>
          </span>
        </div>
      </div>

      {/* Main Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {pricingPlans.map((plan) => {
          const PlanIcon = plan.icon
          const isSelected = selectedPlan === plan.id
          const savings = getSavings(plan)

          return (
            <Card
              key={plan.id}
              className={`relative bg-gray-800 transition-all duration-300 cursor-pointer ${getColorClasses(
                plan.color,
                isSelected,
              )}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-teal-600 text-white px-4 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className={`p-3 rounded-full bg-${plan.color}-600/20`}>
                    <PlanIcon className={`h-8 w-8 text-${plan.color}-400`} />
                  </div>
                </div>

                <CardTitle className="text-2xl font-bold text-white mb-2">{plan.name}</CardTitle>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                <div className="mb-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">{getPrice(plan)}</span>
                    {plan.monthlyPrice > 0 && <span className="text-gray-400">/month</span>}
                  </div>
                  {isYearly && savings && savings > 0 && (
                    <div className="text-green-400 text-sm mt-1">Save ${savings}/year</div>
                  )}
                  {!isYearly && plan.monthlyPrice > 0 && (
                    <div className="text-gray-500 text-sm mt-1">Billed monthly</div>
                  )}
                  {isYearly && plan.monthlyPrice > 0 && (
                    <div className="text-gray-500 text-sm mt-1">Billed annually</div>
                  )}
                </div>

                <Button className={`w-full ${getButtonClasses(plan.color)} text-white font-semibold`}>
                  {plan.cta}
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-white font-medium text-sm mb-2">Included Features:</h4>
                    <div className="space-y-2">
                      {plan.features.included.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {plan.features.excluded.length > 0 && (
                    <div>
                      <h4 className="text-gray-400 font-medium text-sm mb-2">Not Included:</h4>
                      <div className="space-y-2">
                        {plan.features.excluded.slice(0, 3).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <X className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-500">{feature}</span>
                          </div>
                        ))}
                        {plan.features.excluded.length > 3 && (
                          <div className="text-gray-500 text-xs">+{plan.features.excluded.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add-On Services */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">Add-On Services</h2>
          <p className="text-gray-400">Enhance your longevity journey with specialized testing and services</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {addOnServices.map((service) => {
            const ServiceIcon = service.icon
            return (
              <Card key={service.id} className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-full bg-teal-600/20">
                      <ServiceIcon className="h-5 w-5 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{service.name}</h3>
                      <div className="text-teal-400 font-bold">${service.price}</div>
                    </div>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">{service.description}</p>

                  <div className="space-y-2 mb-4">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-3 w-3 text-green-400" />
                        <span className="text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full bg-teal-600 hover:bg-teal-700">Add to Plan</Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Enterprise Plans */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">Enterprise Solutions</h2>
          <p className="text-gray-400">Comprehensive platforms for clinics, researchers, and institutions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {enterprisePlans.map((plan) => {
            const PlanIcon = plan.icon
            return (
              <Card key={plan.id} className="bg-gray-800 border-gray-700 hover:border-purple-500/50 transition-all">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-full bg-purple-600/20">
                      <PlanIcon className="h-8 w-8 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                      <p className="text-gray-400">{plan.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-400" />
                        <span className="text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-2xl font-bold text-white">{plan.price}</div>
                    <Button className="bg-purple-600 hover:bg-purple-700">Contact Sales</Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="text-center">
        <Alert className="border-blue-500/20 bg-blue-500/10 max-w-4xl mx-auto">
          <Award className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200">
            <strong>30-Day Money-Back Guarantee</strong>
            <br />
            Try any paid plan risk-free. If you're not completely satisfied with your longevity optimization results,
            we'll refund your subscription within 30 days.
          </AlertDescription>
        </Alert>

        <div className="mt-8 flex justify-center gap-4">
          <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
            Compare All Features
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Users className="h-4 w-4 mr-2" />
            Talk to Sales
          </Button>
        </div>
      </div>
    </div>
  )
}
