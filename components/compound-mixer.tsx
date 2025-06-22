"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Plus,
  AlertTriangle,
  Info,
  Beaker,
  Heart,
  Filter,
  BookOpen,
  Star,
  Clock,
  Users,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Share2,
} from "lucide-react"

const compounds = [
  {
    id: 1,
    name: "Resveratrol",
    category: "Antioxidant",
    description: "A natural polyphenol found in red wine, grapes, and berries",
    simpleExplanation:
      "Helps protect your cells from damage and may support heart health. Think of it as a cellular bodyguard.",
    detailedExplanation:
      "Resveratrol activates sirtuins (longevity proteins), reduces inflammation, and provides cardiovascular protection through multiple pathways including improved endothelial function.",
    effects: ["Antioxidant Protection", "Heart Health", "Anti-inflammatory", "Sirtuin Activation"],
    safetyLevel: "safe",
    safetyScore: 95,
    maxDose: 1000,
    recommendedDose: 250,
    warnings: ["May interact with blood thinners", "Can enhance effects of diabetes medications"],
    contraindications: ["Pregnancy", "Bleeding disorders", "Surgery (stop 2 weeks before)"],
    beginnerFriendly: true,
    popularity: 92,
    researchPapers: 1247,
    userRating: 4.6,
    mechanismOfAction: "Activates SIRT1, reduces NF-κB signaling, enhances mitochondrial function",
    bioavailability: "Low (enhanced with piperine)",
    halfLife: "9 hours",
    foodSources: ["Red grapes", "Red wine", "Blueberries", "Cranberries"],
    synergies: ["Quercetin", "Curcumin", "Green Tea Extract"],
    sideEffects: ["Mild stomach upset", "Headache (rare)", "Dizziness (high doses)"],
    cost: "$",
    evidenceLevel: "Strong",
  },
  {
    id: 2,
    name: "NMN (Nicotinamide Mononucleotide)",
    category: "NAD+ Booster",
    description: "A precursor to NAD+, essential for cellular energy production and DNA repair",
    simpleExplanation:
      "Helps your cells produce more energy and repair themselves better. Like giving your cellular power plants a boost.",
    detailedExplanation:
      "NMN is converted to NAD+ in cells, supporting mitochondrial function, DNA repair mechanisms, and cellular metabolism. Critical for maintaining cellular energy as we age.",
    effects: ["Energy Production", "DNA Repair", "Metabolism Boost", "Mitochondrial Function"],
    safetyLevel: "caution",
    safetyScore: 78,
    maxDose: 1000,
    recommendedDose: 250,
    warnings: [
      "Limited long-term human studies",
      "May cause nausea in some people",
      "Potential interactions with diabetes medications",
    ],
    contraindications: ["Pregnancy", "Breastfeeding", "Autoimmune conditions"],
    beginnerFriendly: false,
    popularity: 87,
    researchPapers: 423,
    userRating: 4.3,
    mechanismOfAction: "Converts to NAD+ via NMNAT enzymes, supports sirtuins and PARPs",
    bioavailability: "Moderate (sublingual preferred)",
    halfLife: "15 minutes",
    foodSources: ["Broccoli", "Cabbage", "Cucumber", "Edamame"],
    synergies: ["Resveratrol", "Pterostilbene", "Quercetin"],
    sideEffects: ["Nausea", "Fatigue", "Headache", "Diarrhea"],
    cost: "$$$",
    evidenceLevel: "Moderate",
  },
  {
    id: 3,
    name: "Quercetin",
    category: "Senolytic",
    description: "A flavonoid with senolytic properties that may help remove damaged cells",
    simpleExplanation:
      "Helps your body clear out old, damaged cells that contribute to aging. Like a cellular cleanup crew.",
    detailedExplanation:
      "Quercetin induces apoptosis in senescent cells, reduces inflammatory cytokines, and provides antioxidant protection. Key component in senolytic therapy protocols.",
    effects: ["Cellular Cleanup", "Anti-inflammatory", "Immune Support", "Antioxidant"],
    safetyLevel: "safe",
    safetyScore: 88,
    maxDose: 1000,
    recommendedDose: 500,
    warnings: ["May enhance effects of certain medications", "Can interact with antibiotics"],
    contraindications: ["Kidney disease", "Pregnancy (high doses)"],
    beginnerFriendly: true,
    popularity: 79,
    researchPapers: 892,
    userRating: 4.4,
    mechanismOfAction: "Inhibits senescent cell anti-apoptotic pathways, reduces SASP",
    bioavailability: "Low (improved with bromelain)",
    halfLife: "11-28 hours",
    foodSources: ["Onions", "Apples", "Berries", "Green tea"],
    synergies: ["Dasatinib", "Fisetin", "EGCG"],
    sideEffects: ["Headache", "Stomach upset", "Tingling"],
    cost: "$",
    evidenceLevel: "Strong",
  },
  {
    id: 4,
    name: "Curcumin",
    category: "Anti-inflammatory",
    description: "The active compound in turmeric with powerful anti-inflammatory properties",
    simpleExplanation:
      "A natural anti-inflammatory that helps reduce chronic inflammation throughout your body. Like a fire extinguisher for cellular inflammation.",
    detailedExplanation:
      "Curcumin inhibits multiple inflammatory pathways including NF-κB, COX-2, and 5-LOX. Provides neuroprotection and supports joint health through anti-inflammatory mechanisms.",
    effects: ["Anti-inflammatory", "Neuroprotection", "Joint Health", "Antioxidant"],
    safetyLevel: "safe",
    safetyScore: 91,
    maxDose: 1500,
    recommendedDose: 500,
    warnings: ["May increase bleeding risk", "Can interact with chemotherapy drugs"],
    contraindications: ["Gallstones", "Bleeding disorders", "Surgery"],
    beginnerFriendly: true,
    popularity: 85,
    researchPapers: 1156,
    userRating: 4.5,
    mechanismOfAction: "Inhibits NF-κB, modulates inflammatory cytokines, scavenges ROS",
    bioavailability: "Very low (requires piperine or liposomal form)",
    halfLife: "6-7 hours",
    foodSources: ["Turmeric", "Curry powder"],
    synergies: ["Piperine", "Quercetin", "Boswellia"],
    sideEffects: ["Stomach upset", "Nausea", "Diarrhea"],
    cost: "$",
    evidenceLevel: "Strong",
  },
  {
    id: 5,
    name: "Fisetin",
    category: "Senolytic",
    description: "A flavonoid with potent senolytic and neuroprotective properties",
    simpleExplanation:
      "Another cellular cleanup compound that's especially good for brain health. Helps remove old brain cells and protect new ones.",
    detailedExplanation:
      "Fisetin is one of the most potent natural senolytics, effectively clearing senescent cells while providing neuroprotection through multiple pathways including AMPK activation.",
    effects: ["Senolytic Activity", "Neuroprotection", "Memory Enhancement", "Anti-inflammatory"],
    safetyLevel: "caution",
    safetyScore: 82,
    maxDose: 500,
    recommendedDose: 100,
    warnings: ["Limited human studies", "May interact with blood thinners"],
    contraindications: ["Pregnancy", "Bleeding disorders"],
    beginnerFriendly: false,
    popularity: 71,
    researchPapers: 234,
    userRating: 4.2,
    mechanismOfAction: "Induces senescent cell apoptosis, activates AMPK, reduces neuroinflammation",
    bioavailability: "Low",
    halfLife: "Unknown in humans",
    foodSources: ["Strawberries", "Apples", "Persimmons", "Onions"],
    synergies: ["Quercetin", "Dasatinib", "Spermidine"],
    sideEffects: ["Mild stomach upset", "Headache"],
    cost: "$$",
    evidenceLevel: "Moderate",
  },
  {
    id: 6,
    name: "Spermidine",
    category: "Autophagy Inducer",
    description: "A polyamine that promotes cellular cleanup through autophagy",
    simpleExplanation:
      "Helps your cells clean themselves from the inside out, like having a cellular recycling system that removes damaged parts.",
    detailedExplanation:
      "Spermidine induces autophagy, the cellular process of removing damaged organelles and proteins. Shows promise for longevity and cardiovascular health.",
    effects: ["Autophagy Induction", "Cardiovascular Health", "Neuroprotection", "Longevity"],
    safetyLevel: "safe",
    safetyScore: 86,
    maxDose: 10,
    recommendedDose: 1,
    warnings: ["May cause mild digestive upset initially"],
    contraindications: ["None known"],
    beginnerFriendly: true,
    popularity: 68,
    researchPapers: 187,
    userRating: 4.1,
    mechanismOfAction: "Inhibits EP300, induces autophagy, supports mitochondrial function",
    bioavailability: "Good",
    halfLife: "Unknown",
    foodSources: ["Wheat germ", "Soybeans", "Mushrooms", "Aged cheese"],
    synergies: ["Rapamycin", "Metformin", "Resveratrol"],
    sideEffects: ["Mild digestive upset"],
    cost: "$$",
    evidenceLevel: "Moderate",
  },
]

const categories = ["All", "Antioxidant", "NAD+ Booster", "Senolytic", "Anti-inflammatory", "Autophagy Inducer"]
const safetyLevels = ["All", "Safe", "Caution", "Warning"]

export function CompoundMixer() {
  const [selectedCompounds, setSelectedCompounds] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedSafetyLevel, setSelectedSafetyLevel] = useState("All")
  const [showBeginner, setShowBeginner] = useState(true)
  const [sortBy, setSortBy] = useState("popularity")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<any>(null)

  const filteredCompounds = compounds
    .filter((compound) => {
      const matchesSearch =
        compound.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        compound.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "All" || compound.category === selectedCategory
      const matchesSafety =
        selectedSafetyLevel === "All" ||
        (selectedSafetyLevel === "Safe" && compound.safetyLevel === "safe") ||
        (selectedSafetyLevel === "Caution" && compound.safetyLevel === "caution") ||
        (selectedSafetyLevel === "Warning" && compound.safetyLevel === "warning")
      const matchesBeginner = !showBeginner || compound.beginnerFriendly

      return matchesSearch && matchesCategory && matchesSafety && matchesBeginner
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "popularity":
          return b.popularity - a.popularity
        case "safety":
          return b.safetyScore - a.safetyScore
        case "rating":
          return b.userRating - a.userRating
        case "research":
          return b.researchPapers - a.researchPapers
        default:
          return 0
      }
    })

  const addCompound = (compound: any) => {
    if (!selectedCompounds.find((c) => c.id === compound.id)) {
      setSelectedCompounds([...selectedCompounds, { ...compound, dose: compound.recommendedDose }])
    }
  }

  const removeCompound = (id: number) => {
    setSelectedCompounds(selectedCompounds.filter((c) => c.id !== id))
  }

  const updateDose = (id: number, dose: number[]) => {
    setSelectedCompounds(selectedCompounds.map((c) => (c.id === id ? { ...c, dose: dose[0] } : c)))
  }

  const analyzeMixture = async () => {
    setIsAnalyzing(true)
    // Simulate AI analysis
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const totalSafetyScore = selectedCompounds.reduce((acc, c) => acc + c.safetyScore, 0) / selectedCompounds.length
    const interactions = selectedCompounds.length > 1 ? Math.floor(Math.random() * 3) : 0

    setAnalysisResults({
      overallSafety: totalSafetyScore,
      interactions: interactions,
      recommendations: [
        "Consider taking with food to reduce stomach upset",
        "Start with lower doses and gradually increase",
        "Monitor for any unusual symptoms",
      ],
      synergies: selectedCompounds.filter((c) =>
        c.synergies.some((s: string) => selectedCompounds.some((sc) => sc.name.includes(s))),
      ),
      warnings: selectedCompounds.flatMap((c) => c.warnings).slice(0, 3),
    })
    setIsAnalyzing(false)
  }

  const getSafetyColor = (level: string, score?: number) => {
    if (score) {
      if (score >= 90) return "text-green-400 border-green-400"
      if (score >= 75) return "text-yellow-400 border-yellow-400"
      return "text-red-400 border-red-400"
    }

    switch (level) {
      case "safe":
        return "text-green-400 border-green-400"
      case "caution":
        return "text-yellow-400 border-yellow-400"
      case "warning":
        return "text-red-400 border-red-400"
      default:
        return "text-gray-400 border-gray-400"
    }
  }

  const getSafetyIcon = (level: string) => {
    switch (level) {
      case "safe":
        return CheckCircle
      case "caution":
        return AlertCircle
      case "warning":
        return XCircle
      default:
        return Info
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Advanced Compound Mixer</h1>
        <p className="text-gray-400 text-lg mb-4">
          Safely explore anti-aging compounds with AI-powered analysis and comprehensive safety monitoring
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Safety Verified
          </Badge>
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Zap className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <BookOpen className="h-3 w-3 mr-1" />
            Educational
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Compound Library */}
        <div className="lg:col-span-3">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                Compound Library
                <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">
                  {filteredCompounds.length} compounds
                </Badge>
              </CardTitle>
              <CardDescription>
                Explore our comprehensive database of anti-aging compounds with detailed safety information
              </CardDescription>

              {/* Enhanced Filters */}
              <div className="space-y-4">
                <div className="flex gap-4 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search compounds, effects, or mechanisms..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <Button
                    variant={showBeginner ? "default" : "outline"}
                    onClick={() => setShowBeginner(!showBeginner)}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Beginner Friendly
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedSafetyLevel}
                    onChange={(e) => setSelectedSafetyLevel(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    {safetyLevels.map((level) => (
                      <option key={level} value={level}>
                        Safety: {level}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    <option value="popularity">Sort by Popularity</option>
                    <option value="safety">Sort by Safety</option>
                    <option value="rating">Sort by Rating</option>
                    <option value="research">Sort by Research</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {filteredCompounds.map((compound) => {
                  const SafetyIcon = getSafetyIcon(compound.safetyLevel)
                  const isSelected = selectedCompounds.find((c) => c.id === compound.id)

                  return (
                    <Card
                      key={compound.id}
                      className={`bg-gray-700 border-gray-600 transition-all duration-300 ${isSelected ? "ring-2 ring-teal-500" : "hover:border-teal-500/50"}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-white font-semibold text-xl">{compound.name}</h3>
                              <Badge variant="outline" className={getSafetyColor(compound.safetyLevel)}>
                                <SafetyIcon className="h-3 w-3 mr-1" />
                                {compound.category}
                              </Badge>
                              {!compound.beginnerFriendly && (
                                <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">
                                  Advanced
                                </Badge>
                              )}
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-400" />
                                <span>{compound.userRating}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{compound.popularity}% popular</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <BookOpen className="h-4 w-4" />
                                <span>{compound.researchPapers} studies</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Shield className="h-4 w-4" />
                                <span>{compound.safetyScore}% safe</span>
                              </div>
                            </div>
                          </div>

                          <Button
                            onClick={() => (isSelected ? removeCompound(compound.id) : addCompound(compound))}
                            size="sm"
                            className={isSelected ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"}
                          >
                            {isSelected ? (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Remove
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>

                        <Tabs defaultValue="simple" className="w-full">
                          <TabsList className="grid w-full grid-cols-4 bg-gray-600">
                            <TabsTrigger value="simple" className="text-xs">
                              Simple
                            </TabsTrigger>
                            <TabsTrigger value="detailed" className="text-xs">
                              Detailed
                            </TabsTrigger>
                            <TabsTrigger value="safety" className="text-xs">
                              Safety
                            </TabsTrigger>
                            <TabsTrigger value="research" className="text-xs">
                              Research
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="simple" className="mt-4">
                            <p className="text-gray-300 text-sm mb-3 leading-relaxed">{compound.simpleExplanation}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {compound.effects.map((effect, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs bg-teal-600/20 text-teal-300">
                                  {effect}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-sm text-gray-400">
                              <strong>Recommended dose:</strong> {compound.recommendedDose}mg daily
                            </div>
                          </TabsContent>

                          <TabsContent value="detailed" className="mt-4">
                            <p className="text-gray-300 text-sm mb-3 leading-relaxed">{compound.detailedExplanation}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong className="text-gray-300">Mechanism:</strong>
                                <p className="text-gray-400 mt-1">{compound.mechanismOfAction}</p>
                              </div>
                              <div>
                                <strong className="text-gray-300">Bioavailability:</strong>
                                <p className="text-gray-400 mt-1">{compound.bioavailability}</p>
                              </div>
                              <div>
                                <strong className="text-gray-300">Food Sources:</strong>
                                <p className="text-gray-400 mt-1">{compound.foodSources.join(", ")}</p>
                              </div>
                              <div>
                                <strong className="text-gray-300">Synergies:</strong>
                                <p className="text-gray-400 mt-1">{compound.synergies.join(", ")}</p>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="safety" className="mt-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <SafetyIcon
                                  className={`h-5 w-5 ${getSafetyColor(compound.safetyLevel).split(" ")[0]}`}
                                />
                                <span className="text-white font-medium">Safety Score: {compound.safetyScore}/100</span>
                              </div>

                              <Progress value={compound.safetyScore} className="w-full" />

                              {compound.warnings.length > 0 && (
                                <Alert className="border-yellow-500/20 bg-yellow-500/10">
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  <AlertDescription className="text-yellow-200 text-sm">
                                    <strong>Warnings:</strong> {compound.warnings.join(", ")}
                                  </AlertDescription>
                                </Alert>
                              )}

                              {compound.contraindications.length > 0 && (
                                <Alert className="border-red-500/20 bg-red-500/10">
                                  <XCircle className="h-4 w-4 text-red-500" />
                                  <AlertDescription className="text-red-200 text-sm">
                                    <strong>Contraindications:</strong> {compound.contraindications.join(", ")}
                                  </AlertDescription>
                                </Alert>
                              )}

                              <div className="text-sm text-gray-400">
                                <strong>Side Effects:</strong> {compound.sideEffects.join(", ")}
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="research" className="mt-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong className="text-gray-300">Research Papers:</strong>
                                <p className="text-gray-400">{compound.researchPapers} published studies</p>
                              </div>
                              <div>
                                <strong className="text-gray-300">Evidence Level:</strong>
                                <Badge
                                  className={
                                    compound.evidenceLevel === "Strong"
                                      ? "bg-green-600/20 text-green-300"
                                      : "bg-yellow-600/20 text-yellow-300"
                                  }
                                >
                                  {compound.evidenceLevel}
                                </Badge>
                              </div>
                              <div>
                                <strong className="text-gray-300">User Rating:</strong>
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                  <span className="text-gray-400">{compound.userRating}/5</span>
                                </div>
                              </div>
                              <div>
                                <strong className="text-gray-300">Cost:</strong>
                                <span className="text-gray-400">{compound.cost}</span>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Mixture Panel */}
        <div>
          <Card className="bg-gray-800 border-gray-700 sticky top-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Your Mixture
              </CardTitle>
              <CardDescription>
                {selectedCompounds.length} compound{selectedCompounds.length !== 1 ? "s" : ""} selected
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedCompounds.length === 0 ? (
                <div className="text-center py-8">
                  <Info className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">No compounds selected</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Choose compounds from the library to start building your personalized mixture
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCompounds.map((compound) => (
                    <Card key={compound.id} className="bg-gray-700 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h4 className="text-white font-medium">{compound.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>Safety: {compound.safetyScore}%</span>
                              <span>•</span>
                              <span>{compound.category}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCompound(compound.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Dose:</span>
                            <span className="text-white font-medium">{compound.dose}mg</span>
                          </div>

                          <Slider
                            value={[compound.dose]}
                            onValueChange={(value) => updateDose(compound.id, value)}
                            max={compound.maxDose}
                            min={50}
                            step={25}
                            className="w-full"
                          />

                          <div className="flex justify-between text-xs text-gray-500">
                            <span>50mg</span>
                            <span className="text-teal-400">Recommended: {compound.recommendedDose}mg</span>
                            <span>{compound.maxDose}mg</span>
                          </div>

                          {compound.dose > compound.recommendedDose * 1.5 && (
                            <Alert className="border-yellow-500/20 bg-yellow-500/10">
                              <AlertTriangle className="h-3 w-3 text-yellow-500" />
                              <AlertDescription className="text-yellow-200 text-xs">
                                High dose - consider consulting a healthcare provider
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <Separator className="bg-gray-600" />

                  {/* Analysis Section */}
                  <div className="space-y-3">
                    <Button
                      onClick={analyzeMixture}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                      disabled={selectedCompounds.length === 0 || isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Analyze Mixture
                        </>
                      )}
                    </Button>

                    {isAnalyzing && (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-400">AI Analysis in progress...</div>
                        <Progress value={33} className="w-full" />
                        <div className="text-xs text-gray-500">
                          Checking interactions, safety scores, and synergies...
                        </div>
                      </div>
                    )}

                    {analysisResults && (
                      <div className="space-y-3">
                        <Alert
                          className={`border-${analysisResults.overallSafety >= 80 ? "green" : analysisResults.overallSafety >= 60 ? "yellow" : "red"}-500/20 bg-${analysisResults.overallSafety >= 80 ? "green" : analysisResults.overallSafety >= 60 ? "yellow" : "red"}-500/10`}
                        >
                          <Shield
                            className={`h-4 w-4 text-${analysisResults.overallSafety >= 80 ? "green" : analysisResults.overallSafety >= 60 ? "yellow" : "red"}-500`}
                          />
                          <AlertDescription
                            className={`text-${analysisResults.overallSafety >= 80 ? "green" : analysisResults.overallSafety >= 60 ? "yellow" : "red"}-200 text-sm`}
                          >
                            <strong>Overall Safety: {Math.round(analysisResults.overallSafety)}%</strong>
                            <br />
                            {analysisResults.interactions} potential interactions detected
                          </AlertDescription>
                        </Alert>

                        <div className="text-sm">
                          <strong className="text-gray-300">AI Recommendations:</strong>
                          <ul className="text-gray-400 text-xs mt-1 space-y-1">
                            {analysisResults.recommendations.map((rec: string, idx: number) => (
                              <li key={idx}>• {rec}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            Export
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 text-xs">
                            <Share2 className="h-3 w-3 mr-1" />
                            Share
                          </Button>
                        </div>
                      </div>
                    )}

                    <Alert className="border-blue-500/20 bg-blue-500/10">
                      <Info className="h-4 w-4 text-blue-400" />
                      <AlertDescription className="text-blue-200 text-sm">
                        Our AI analyzes thousands of research papers to provide safety recommendations and interaction
                        warnings.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
