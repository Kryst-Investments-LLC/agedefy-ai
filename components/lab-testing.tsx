"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TestTube,
  Calendar,
  Truck,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Home,
  Building,
  Microscope,
  Heart,
  Brain,
  Dna,
  Activity,
  Shield,
  Star,
  Package,
} from "lucide-react"

const testPanels = [
  {
    id: "longevity-complete",
    name: "Complete Longevity Panel",
    description: "Comprehensive biomarker analysis for optimal aging assessment",
    price: 299,
    originalPrice: 399,
    duration: "3-5 business days",
    sampleType: "Blood + Saliva",
    biomarkers: 47,
    category: "Comprehensive",
    popular: true,
    athome: true,
    tests: [
      "NAD+ levels",
      "Telomere length",
      "Inflammatory markers (CRP, IL-6)",
      "Advanced lipid panel",
      "HbA1c & glucose metabolism",
      "Hormone panel (testosterone, estrogen, cortisol)",
      "Vitamin D, B12, folate",
      "Omega-3 index",
      "Heavy metals screen",
      "Genetic variants (ApoE, MTHFR)",
    ],
    features: ["AI interpretation", "Personalized recommendations", "Trend tracking", "Doctor review available"],
  },
  {
    id: "nad-optimization",
    name: "NAD+ Optimization Panel",
    description: "Focused analysis for cellular energy and NAD+ pathway assessment",
    price: 149,
    originalPrice: 199,
    duration: "2-3 business days",
    sampleType: "Blood",
    biomarkers: 12,
    category: "Specialized",
    popular: false,
    athome: true,
    tests: [
      "NAD+ levels",
      "NADH ratio",
      "Sirtuin activity markers",
      "Mitochondrial function",
      "Oxidative stress markers",
      "B-vitamin status",
    ],
    features: ["NMN/NR dosing recommendations", "Supplement optimization", "Progress tracking"],
  },
  {
    id: "inflammation-senescence",
    name: "Inflammation & Senescence Panel",
    description: "Assess cellular aging and inflammatory burden for senolytic therapy guidance",
    price: 199,
    originalPrice: 249,
    duration: "3-4 business days",
    sampleType: "Blood",
    biomarkers: 18,
    category: "Specialized",
    popular: false,
    athome: true,
    tests: [
      "Senescent cell markers",
      "SASP factors",
      "CRP, IL-6, TNF-α",
      "Galectin-3",
      "Advanced glycation end products",
      "Cellular aging score",
    ],
    features: ["Senolytic protocol recommendations", "Inflammation tracking", "Cellular age assessment"],
  },
  {
    id: "epigenetic-age",
    name: "Epigenetic Age Analysis",
    description: "Determine your biological age using advanced DNA methylation patterns",
    price: 399,
    originalPrice: 499,
    duration: "7-10 business days",
    sampleType: "Saliva",
    biomarkers: 850000,
    category: "Advanced",
    popular: false,
    athome: true,
    tests: ["Horvath clock", "Hannum clock", "PhenoAge", "GrimAge", "DunedinPACE", "Telomere length"],
    features: ["Biological age calculation", "Age acceleration analysis", "Longevity predictions", "Lifestyle impact"],
  },
  {
    id: "microbiome-longevity",
    name: "Longevity Microbiome Analysis",
    description: "Comprehensive gut health assessment for longevity optimization",
    price: 179,
    originalPrice: 229,
    duration: "5-7 business days",
    sampleType: "Stool",
    biomarkers: 200,
    category: "Specialized",
    popular: false,
    athome: true,
    tests: [
      "Bacterial diversity",
      "Longevity-associated species",
      "SCFA production",
      "Inflammatory markers",
      "Pathogen screening",
      "Antibiotic resistance genes",
    ],
    features: ["Probiotic recommendations", "Dietary guidance", "Supplement suggestions", "Progress tracking"],
  },
  {
    id: "executive-physical",
    name: "Executive Longevity Physical",
    description: "Comprehensive in-clinic assessment with advanced imaging and testing",
    price: 1299,
    originalPrice: 1599,
    duration: "Same day results",
    sampleType: "Comprehensive",
    biomarkers: 150,
    category: "Premium",
    popular: false,
    athome: false,
    tests: [
      "Full body MRI",
      "Coronary calcium score",
      "DEXA scan",
      "VO2 max testing",
      "Comprehensive blood panel",
      "Cognitive assessment",
      "Body composition analysis",
      "Vascular health screening",
    ],
    features: ["Same-day results", "Doctor consultation", "Personalized protocol", "Annual tracking"],
  },
]

const recentResults = [
  {
    id: 1,
    testName: "Complete Longevity Panel",
    date: "2024-12-20",
    status: "completed",
    biologicalAge: 28,
    chronologicalAge: 35,
    keyFindings: ["NAD+ levels optimal", "Low inflammation", "Excellent metabolic health"],
    actionItems: ["Continue current protocol", "Add omega-3 supplementation", "Monitor vitamin D"],
  },
  {
    id: 2,
    testName: "NAD+ Optimization Panel",
    date: "2024-11-15",
    status: "completed",
    keyFindings: ["NAD+ increased 40%", "Improved mitochondrial function", "Reduced oxidative stress"],
    actionItems: ["Maintain NMN dosage", "Add resveratrol", "Track energy levels"],
  },
  {
    id: 3,
    testName: "Inflammation Panel",
    date: "2024-12-22",
    status: "processing",
    estimatedCompletion: "2024-12-26",
  },
]

const upcomingTests = [
  {
    id: 1,
    testName: "Epigenetic Age Analysis",
    scheduledDate: "2025-01-15",
    kitStatus: "shipped",
    trackingNumber: "1Z999AA1234567890",
  },
  {
    id: 2,
    testName: "Executive Physical",
    scheduledDate: "2025-02-01",
    location: "Longevity Clinic - Manhattan",
    kitStatus: "scheduled",
  },
]

export function LabTesting() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null)

  const categories = ["All", "Comprehensive", "Specialized", "Advanced", "Premium"]

  const filteredPanels = testPanels.filter((panel) => {
    return selectedCategory === "All" || panel.category === selectedCategory
  })

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Comprehensive":
        return "bg-blue-600/20 text-blue-300 border-blue-500/20"
      case "Specialized":
        return "bg-purple-600/20 text-purple-300 border-purple-500/20"
      case "Advanced":
        return "bg-orange-600/20 text-orange-300 border-orange-500/20"
      case "Premium":
        return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400"
      case "processing":
        return "text-yellow-400"
      case "shipped":
        return "text-blue-400"
      case "scheduled":
        return "text-purple-400"
      default:
        return "text-gray-400"
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Advanced Lab Testing</h1>
        <p className="text-gray-400 text-lg mb-4">
          Comprehensive biomarker analysis with AI-powered insights and personalized recommendations
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <Home className="h-3 w-3 mr-1" />
            At-Home Kits
          </Badge>
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Microscope className="h-3 w-3 mr-1" />
            CLIA Certified
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <Brain className="h-3 w-3 mr-1" />
            AI Analysis
          </Badge>
          <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Doctor Reviewed
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-8">
          <TabsTrigger value="available">Available Tests</TabsTrigger>
          <TabsTrigger value="results">My Results</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Tests</TabsTrigger>
          <TabsTrigger value="trends">Health Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Test Panels */}
            <div className="lg:col-span-3">
              {/* Category Filter */}
              <Card className="bg-gray-800 border-gray-700 mb-6">
                <CardContent className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(category)}
                        className={
                          selectedCategory === category
                            ? "bg-teal-600 hover:bg-teal-700"
                            : "border-gray-600 text-gray-300 hover:bg-gray-700"
                        }
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Test Panels Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPanels.map((panel) => (
                  <Card
                    key={panel.id}
                    className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300 group"
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-white font-semibold text-lg">{panel.name}</h3>
                            {panel.popular && (
                              <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">
                                <Star className="h-3 w-3 mr-1" />
                                Popular
                              </Badge>
                            )}
                          </div>
                          <Badge className={getCategoryColor(panel.category)} variant="outline">
                            {panel.category}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-gray-400 text-sm mb-4">{panel.description}</p>

                      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                        <div className="flex items-center gap-2">
                          <TestTube className="h-4 w-4 text-teal-400" />
                          <span className="text-gray-300">{panel.biomarkers} biomarkers</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">{panel.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {panel.athome ? (
                            <Home className="h-4 w-4 text-green-400" />
                          ) : (
                            <Building className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-gray-300">{panel.athome ? "At-home kit" : "In-clinic"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-yellow-400" />
                          <span className="text-gray-300">{panel.sampleType}</span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-white font-medium text-sm mb-2">Key Tests Include:</h4>
                        <div className="space-y-1">
                          {panel.tests.slice(0, 4).map((test, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-400">
                              <CheckCircle className="h-3 w-3 text-green-400" />
                              <span>{test}</span>
                            </div>
                          ))}
                          {panel.tests.length > 4 && (
                            <div className="text-sm text-teal-400">+{panel.tests.length - 4} more tests</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-4">
                        {panel.features.map((feature, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <span className="text-2xl font-bold text-white">${panel.price}</span>
                          {panel.originalPrice > panel.price && (
                            <span className="text-gray-400 line-through ml-2">${panel.originalPrice}</span>
                          )}
                        </div>
                        <div className="text-sm text-green-400">Save ${panel.originalPrice - panel.price}</div>
                      </div>

                      <Button className="w-full bg-teal-600 hover:bg-teal-700">
                        <TestTube className="h-4 w-4 mr-2" />
                        Order Test Kit
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* How It Works */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">How It Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-teal-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">
                        1
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Order Your Kit</h4>
                        <p className="text-gray-400 text-xs">Choose your test panel and order online</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-teal-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">
                        2
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Collect Sample</h4>
                        <p className="text-gray-400 text-xs">Easy at-home collection with clear instructions</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-teal-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">
                        3
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Ship & Analyze</h4>
                        <p className="text-gray-400 text-xs">Free shipping to CLIA-certified lab</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-teal-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">
                        4
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Get Results</h4>
                        <p className="text-gray-400 text-xs">AI-powered insights with recommendations</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quality Assurance */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Quality Assurance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">CLIA-certified laboratories</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">CAP-accredited facilities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">Doctor-reviewed results</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">HIPAA-compliant data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">Money-back guarantee</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Support */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Need Help?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      <FileText className="h-4 w-4 mr-2" />
                      Test Guide
                    </Button>
                    <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                      Chat with Expert
                    </Button>
                    <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                      Schedule Consultation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results">
          <div className="space-y-6">
            {recentResults.map((result) => (
              <Card key={result.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-lg mb-1">{result.testName}</h3>
                      <p className="text-gray-400 text-sm">Completed on {result.date}</p>
                    </div>
                    <Badge
                      className={
                        result.status === "completed"
                          ? "bg-green-600/20 text-green-300 border-green-500/20"
                          : "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
                      }
                    >
                      {result.status === "completed" ? "Completed" : "Processing"}
                    </Badge>
                  </div>

                  {result.status === "completed" ? (
                    <div className="space-y-4">
                      {result.biologicalAge && (
                        <Alert className="border-green-500/20 bg-green-500/10">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <AlertDescription className="text-green-200">
                            <strong>Biological Age: {result.biologicalAge} years</strong> (vs chronological age:{" "}
                            {result.chronologicalAge})
                            <br />
                            You're aging {result.chronologicalAge - result.biologicalAge} years slower than average!
                          </AlertDescription>
                        </Alert>
                      )}

                      <div>
                        <h4 className="text-white font-medium mb-2">Key Findings:</h4>
                        <div className="space-y-1">
                          {result.keyFindings.map((finding, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                              <CheckCircle className="h-4 w-4 text-green-400" />
                              <span>{finding}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-white font-medium mb-2">Recommended Actions:</h4>
                        <div className="space-y-1">
                          {result.actionItems.map((action, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                              <AlertCircle className="h-4 w-4 text-blue-400" />
                              <span>{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button className="bg-teal-600 hover:bg-teal-700">
                          <FileText className="h-4 w-4 mr-2" />
                          View Full Report
                        </Button>
                        <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                          Share with Doctor
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Clock className="h-4 w-4" />
                        <span>Processing - estimated completion: {result.estimatedCompletion}</span>
                      </div>
                      <Progress value={75} className="w-full" />
                      <p className="text-gray-400 text-sm">
                        Your sample is being analyzed. You'll receive an email when results are ready.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="upcoming">
          <div className="space-y-6">
            {upcomingTests.map((test) => (
              <Card key={test.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-lg mb-1">{test.testName}</h3>
                      <p className="text-gray-400 text-sm">Scheduled for {test.scheduledDate}</p>
                      {test.location && <p className="text-gray-400 text-sm">{test.location}</p>}
                    </div>
                    <Badge
                      className={
                        test.kitStatus === "shipped"
                          ? "bg-blue-600/20 text-blue-300"
                          : "bg-purple-600/20 text-purple-300"
                      }
                    >
                      {test.kitStatus === "shipped" ? "Kit Shipped" : "Scheduled"}
                    </Badge>
                  </div>

                  {test.trackingNumber && (
                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4 text-blue-400" />
                        <span className="text-blue-300 font-medium">Kit Shipped</span>
                      </div>
                      <p className="text-blue-200 text-sm">
                        Tracking: {test.trackingNumber}
                        <br />
                        Expected delivery: Tomorrow
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {test.trackingNumber ? (
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Truck className="h-4 w-4 mr-2" />
                        Track Package
                      </Button>
                    ) : (
                      <Button className="bg-teal-600 hover:bg-teal-700">
                        <Calendar className="h-4 w-4 mr-2" />
                        Reschedule
                      </Button>
                    )}
                    <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-400" />
                  Cardiovascular Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Overall Score</span>
                    <span className="text-green-400 font-bold">92/100</span>
                  </div>
                  <Progress value={92} className="w-full" />
                  <div className="text-sm text-gray-400">
                    <div className="flex justify-between">
                      <span>LDL Cholesterol</span>
                      <span className="text-green-400">Optimal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Blood Pressure</span>
                      <span className="text-green-400">Excellent</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inflammation</span>
                      <span className="text-green-400">Low</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Metabolic Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Overall Score</span>
                    <span className="text-green-400 font-bold">88/100</span>
                  </div>
                  <Progress value={88} className="w-full" />
                  <div className="text-sm text-gray-400">
                    <div className="flex justify-between">
                      <span>HbA1c</span>
                      <span className="text-green-400">Optimal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Insulin Sensitivity</span>
                      <span className="text-yellow-400">Good</span>
                    </div>
                    <div className="flex justify-between">
                      <span>NAD+ Levels</span>
                      <span className="text-green-400">High</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Dna className="h-5 w-5 text-purple-400" />
                  Cellular Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Overall Score</span>
                    <span className="text-green-400 font-bold">85/100</span>
                  </div>
                  <Progress value={85} className="w-full" />
                  <div className="text-sm text-gray-400">
                    <div className="flex justify-between">
                      <span>Telomere Length</span>
                      <span className="text-green-400">Above Average</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Senescent Cells</span>
                      <span className="text-green-400">Low</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DNA Damage</span>
                      <span className="text-yellow-400">Moderate</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
