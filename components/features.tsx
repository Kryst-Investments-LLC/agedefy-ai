import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TestTube,
  Brain,
  Search,
  Users,
  Shield,
  TrendingUp,
  Zap,
  Heart,
  BookOpen,
  Activity,
  Globe,
  Lock,
} from "lucide-react"

const features = [
  {
    icon: TestTube,
    title: "Smart Compound Mixing",
    description:
      "Advanced AI analyzes compound interactions with real-time safety monitoring and personalized recommendations.",
    userFriendly: "We explain every compound in simple terms and warn you about any potential risks or interactions.",
    benefits: ["Real-time safety checks", "Dosage optimization", "Interaction warnings"],
    complexity: "Beginner",
    category: "Core Feature",
  },
  {
    icon: Brain,
    title: "AI Prediction Engine",
    description:
      "Machine learning models predict outcomes with confidence scores, biomarker impacts, and timeline projections.",
    userFriendly: "See results as simple charts and graphs with plain-English explanations of what to expect.",
    benefits: ["95% accuracy rate", "Confidence scoring", "Visual predictions"],
    complexity: "Intermediate",
    category: "AI Technology",
  },
  {
    icon: Search,
    title: "Research Intelligence",
    description: "AI-powered analysis of 15,000+ research papers with instant summaries and relevance scoring.",
    userFriendly: "No more confusing scientific papers - we break down the key findings into digestible insights.",
    benefits: ["Instant summaries", "Relevance scoring", "Citation tracking"],
    complexity: "Beginner",
    category: "Research",
  },
  {
    icon: Users,
    title: "Global Community",
    description: "Connect with 50,000+ longevity enthusiasts, researchers, and experts in moderated forums.",
    userFriendly: "Learn from real people sharing their experiences, with expert moderation for safety.",
    benefits: ["Expert moderation", "Experience sharing", "Peer support"],
    complexity: "Beginner",
    category: "Community",
  },
  {
    icon: Shield,
    title: "Advanced Safety System",
    description: "Multi-layer safety protocols with FDA compliance, drug interaction checks, and medical disclaimers.",
    userFriendly: "We prioritize your safety with comprehensive warnings and guidance on when to see a doctor.",
    benefits: ["FDA compliant", "Drug interactions", "Medical guidance"],
    complexity: "Automatic",
    category: "Safety",
  },
  {
    icon: Activity,
    title: "Biomarker Tracking",
    description: "Monitor key longevity biomarkers with wearable integration and personalized health insights.",
    userFriendly: "Track your progress with easy-to-read charts showing improvements in your health metrics.",
    benefits: ["Wearable sync", "Progress tracking", "Health insights"],
    complexity: "Intermediate",
    category: "Tracking",
  },
  {
    icon: BookOpen,
    title: "Educational Hub",
    description: "Comprehensive learning center with courses, glossary, and expert-reviewed content.",
    userFriendly: "Learn at your own pace with beginner-friendly courses and a comprehensive glossary.",
    benefits: ["Interactive courses", "Expert content", "Progress tracking"],
    complexity: "Beginner",
    category: "Education",
  },
  {
    icon: Zap,
    title: "Personalization Engine",
    description: "Tailored recommendations based on your health profile, goals, and genetic data (optional).",
    userFriendly: "Get personalized suggestions that match your specific health goals and current condition.",
    benefits: ["Custom recommendations", "Goal tracking", "Privacy focused"],
    complexity: "Intermediate",
    category: "Personalization",
  },
  {
    icon: Globe,
    title: "Global Research Network",
    description: "Access to international research databases and collaboration with leading longevity institutions.",
    userFriendly: "Benefit from worldwide research without needing to understand complex scientific databases.",
    benefits: ["Global access", "Institution partnerships", "Latest research"],
    complexity: "Automatic",
    category: "Research",
  },
  {
    icon: Lock,
    title: "Privacy & Security",
    description: "End-to-end encryption, GDPR compliance, and optional anonymous usage for maximum privacy.",
    userFriendly: "Your health data stays private and secure with military-grade encryption and privacy controls.",
    benefits: ["End-to-end encryption", "GDPR compliant", "Anonymous options"],
    complexity: "Automatic",
    category: "Security",
  },
  {
    icon: Heart,
    title: "Wellness Integration",
    description: "Holistic approach combining supplements, lifestyle, exercise, and mental health factors.",
    userFriendly: "Get a complete picture of healthy aging, not just supplements - including lifestyle tips.",
    benefits: ["Holistic approach", "Lifestyle tips", "Mental health"],
    complexity: "Beginner",
    category: "Wellness",
  },
  {
    icon: TrendingUp,
    title: "Progress Analytics",
    description: "Advanced analytics dashboard with trend analysis, goal tracking, and predictive insights.",
    userFriendly: "See your progress over time with simple charts that show how you're improving.",
    benefits: ["Trend analysis", "Goal tracking", "Predictive insights"],
    complexity: "Intermediate",
    category: "Analytics",
  },
]

const getComplexityColor = (complexity: string) => {
  switch (complexity) {
    case "Beginner":
      return "bg-green-600/20 text-green-300 border-green-500/20"
    case "Intermediate":
      return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
    case "Advanced":
      return "bg-red-600/20 text-red-300 border-red-500/20"
    case "Automatic":
      return "bg-blue-600/20 text-blue-300 border-blue-500/20"
    default:
      return "bg-gray-600/20 text-gray-300 border-gray-500/20"
  }
}

const getCategoryColor = (category: string) => {
  const colors = {
    "Core Feature": "bg-teal-600/20 text-teal-300",
    "AI Technology": "bg-purple-600/20 text-purple-300",
    Research: "bg-blue-600/20 text-blue-300",
    Community: "bg-green-600/20 text-green-300",
    Safety: "bg-red-600/20 text-red-300",
    Tracking: "bg-orange-600/20 text-orange-300",
    Education: "bg-indigo-600/20 text-indigo-300",
    Personalization: "bg-pink-600/20 text-pink-300",
    Security: "bg-gray-600/20 text-gray-300",
    Wellness: "bg-emerald-600/20 text-emerald-300",
    Analytics: "bg-cyan-600/20 text-cyan-300",
  }
  return colors[category as keyof typeof colors] || "bg-gray-600/20 text-gray-300"
}

export function Features() {
  return (
    <section className="py-20 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Comprehensive Anti-Aging Platform</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
            Advanced features designed for everyone - from complete beginners to longevity experts
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge className="bg-green-600/20 text-green-300 border-green-500/20">Beginner Friendly</Badge>
            <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">AI Powered</Badge>
            <Badge className="bg-red-600/20 text-red-300 border-red-500/20">Safety First</Badge>
            <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">Expert Approved</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300 group hover:shadow-2xl hover:shadow-teal-500/10"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-500 transition-colors">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={getCategoryColor(feature.category)} variant="outline">
                      {feature.category}
                    </Badge>
                    <Badge className={getComplexityColor(feature.complexity)} variant="outline">
                      {feature.complexity}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-gray-400">{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Benefits */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {feature.benefits.map((benefit, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* User-friendly explanation */}
                  <div className="bg-teal-900/20 border border-teal-500/20 rounded-lg p-3">
                    <p className="text-teal-300 text-sm font-medium mb-1">For Regular Users:</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{feature.userFriendly}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 rounded-2xl p-8 border border-teal-500/20">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to Start Your Longevity Journey?</h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join thousands of users who are already discovering safe, effective anti-aging solutions with our
              comprehensive platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-lg font-medium transition-colors">
                Start Free Trial
              </button>
              <button className="border border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white px-8 py-3 rounded-lg font-medium transition-colors">
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
