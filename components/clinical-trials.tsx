"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Search,
  Users,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Award,
  Microscope,
  Heart,
  Brain,
  Zap,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react"

const clinicalTrials = [
  {
    id: "LONGEVITY-2024-001",
    title: "NMN Supplementation in Healthy Aging Adults",
    description:
      "Phase II randomized controlled trial evaluating the effects of NMN on NAD+ levels and aging biomarkers",
    phase: "Phase II",
    status: "Recruiting",
    sponsor: "Stanford Longevity Institute",
    location: "Stanford, CA",
    duration: "12 months",
    participants: { enrolled: 45, target: 120 },
    compensation: 2500,
    eligibility: {
      ageRange: "35-65 years",
      requirements: [
        "Healthy adults",
        "BMI 18-30",
        "No current supplement use",
        "Willing to travel to Stanford monthly",
      ],
      exclusions: ["Diabetes", "Cardiovascular disease", "Pregnancy", "Current medication use"],
    },
    intervention: "NMN 250mg daily vs placebo",
    primaryEndpoint: "Change in NAD+ levels",
    secondaryEndpoints: ["Biomarker panel", "Physical performance", "Cognitive function"],
    category: "NAD+ Enhancement",
    estimatedCompletion: "December 2025",
    contactEmail: "longevity-trials@stanford.edu",
    featured: true,
  },
  {
    id: "SENOLYTIC-2024-002",
    title: "Quercetin + Dasatinib Senolytic Therapy Study",
    description: "Investigating the safety and efficacy of intermittent senolytic therapy in older adults",
    phase: "Phase I/II",
    status: "Recruiting",
    sponsor: "Mayo Clinic",
    location: "Rochester, MN",
    duration: "6 months",
    participants: { enrolled: 28, target: 60 },
    compensation: 3000,
    eligibility: {
      ageRange: "60-80 years",
      requirements: [
        "Generally healthy",
        "Evidence of cellular senescence",
        "Able to travel to Mayo Clinic",
        "Comprehensive health screening",
      ],
      exclusions: ["Active cancer", "Bleeding disorders", "Kidney disease", "Immunosuppression"],
    },
    intervention: "Quercetin 1000mg + Dasatinib 100mg (3 days every 4 weeks)",
    primaryEndpoint: "Safety and tolerability",
    secondaryEndpoints: ["Senescent cell markers", "Physical function", "Inflammation"],
    category: "Senolytic Therapy",
    estimatedCompletion: "August 2025",
    contactEmail: "senolytic-study@mayo.edu",
    featured: true,
  },
  {
    id: "METFORMIN-2024-003",
    title: "Metformin for Longevity in Non-Diabetic Adults",
    description: "TAME (Targeting Aging with Metformin) pilot study evaluating metformin's anti-aging effects",
    phase: "Phase III",
    status: "Recruiting",
    sponsor: "American Federation for Aging Research",
    location: "Multiple sites (NY, CA, FL)",
    duration: "18 months",
    participants: { enrolled: 234, target: 500 },
    compensation: 1500,
    eligibility: {
      ageRange: "50-75 years",
      requirements: [
        "Non-diabetic",
        "At least one age-related condition",
        "Stable health status",
        "Access to study site",
      ],
      exclusions: ["Diabetes", "Kidney disease", "Heart failure", "Metformin allergy"],
    },
    intervention: "Metformin 1500mg daily vs placebo",
    primaryEndpoint: "Composite aging score",
    secondaryEndpoints: ["Individual aging biomarkers", "Quality of life", "Adverse events"],
    category: "Metabolic Enhancement",
    estimatedCompletion: "June 2026",
    contactEmail: "tame-study@afar.org",
    featured: false,
  },
  {
    id: "RAPAMYCIN-2024-004",
    title: "Low-Dose Rapamycin for Healthy Aging",
    description: "Evaluating the effects of intermittent rapamycin dosing on aging biomarkers and immune function",
    phase: "Phase II",
    status: "Recruiting",
    sponsor: "University of Washington",
    location: "Seattle, WA",
    duration: "24 months",
    participants: { enrolled: 67, target: 150 },
    compensation: 4000,
    eligibility: {
      ageRange: "40-70 years",
      requirements: [
        "Healthy volunteers",
        "Normal immune function",
        "Willing to undergo regular monitoring",
        "Local to Seattle area",
      ],
      exclusions: ["Immunodeficiency", "Active infections", "Cancer history", "Organ transplant"],
    },
    intervention: "Rapamycin 5mg weekly vs placebo",
    primaryEndpoint: "Immune function markers",
    secondaryEndpoints: ["mTOR pathway activity", "Autophagy markers", "Cognitive function"],
    category: "mTOR Inhibition",
    estimatedCompletion: "March 2027",
    contactEmail: "rapamycin-study@uw.edu",
    featured: false,
  },
  {
    id: "EXERCISE-2024-005",
    title: "High-Intensity Interval Training and Longevity Biomarkers",
    description: "Comparing different exercise protocols on cellular aging and metabolic health",
    phase: "Interventional",
    status: "Recruiting",
    sponsor: "Harvard Medical School",
    location: "Boston, MA",
    duration: "8 months",
    participants: { enrolled: 89, target: 200 },
    compensation: 800,
    eligibility: {
      ageRange: "30-60 years",
      requirements: [
        "Sedentary lifestyle",
        "Cleared for exercise",
        "Available for 3x/week training",
        "Boston area resident",
      ],
      exclusions: ["Cardiovascular disease", "Orthopedic limitations", "Current exercise routine", "Pregnancy"],
    },
    intervention: "HIIT vs moderate exercise vs control",
    primaryEndpoint: "VO2 max improvement",
    secondaryEndpoints: ["Telomere length", "Mitochondrial function", "Metabolic markers"],
    category: "Lifestyle Intervention",
    estimatedCompletion: "September 2025",
    contactEmail: "exercise-longevity@harvard.edu",
    featured: false,
  },
]

const myApplications = [
  {
    id: "LONGEVITY-2024-001",
    title: "NMN Supplementation Study",
    status: "Under Review",
    appliedDate: "2024-12-15",
    nextStep: "Phone screening scheduled for Dec 28",
    progress: 60,
  },
  {
    id: "SENOLYTIC-2024-002",
    title: "Quercetin + Dasatinib Study",
    status: "Accepted",
    appliedDate: "2024-11-20",
    nextStep: "Baseline visit scheduled for Jan 5",
    progress: 100,
  },
]

export function ClinicalTrials() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")

  const categories = [
    "All",
    "NAD+ Enhancement",
    "Senolytic Therapy",
    "Metabolic Enhancement",
    "mTOR Inhibition",
    "Lifestyle Intervention",
  ]
  const statuses = ["All", "Recruiting", "Active", "Completed"]

  const filteredTrials = clinicalTrials.filter((trial) => {
    const matchesSearch =
      trial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trial.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || trial.category === selectedCategory
    const matchesStatus = selectedStatus === "All" || trial.status === selectedStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Recruiting":
        return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Active":
        return "bg-blue-600/20 text-blue-300 border-blue-500/20"
      case "Completed":
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
      case "Under Review":
        return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "Accepted":
        return "bg-green-600/20 text-green-300 border-green-500/20"
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "NAD+ Enhancement":
        return Zap
      case "Senolytic Therapy":
        return Microscope
      case "Metabolic Enhancement":
        return Heart
      case "mTOR Inhibition":
        return Brain
      case "Lifestyle Intervention":
        return TrendingUp
      default:
        return FileText
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Clinical Trials & Research</h1>
        <p className="text-gray-400 text-lg mb-4">
          Participate in cutting-edge longevity research and contribute to the future of healthy aging
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <Award className="h-3 w-3 mr-1" />
            Compensation Provided
          </Badge>
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Shield className="h-3 w-3 mr-1" />
            IRB Approved
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <Microscope className="h-3 w-3 mr-1" />
            Cutting-Edge Research
          </Badge>
          <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">
            <Star className="h-3 w-3 mr-1" />
            Early Access
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search and Filters */}
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search clinical trials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Trials */}
          <div className="space-y-6">
            {filteredTrials.map((trial) => {
              const CategoryIcon = getCategoryIcon(trial.category)
              const enrollmentProgress = (trial.participants.enrolled / trial.participants.target) * 100

              return (
                <Card
                  key={trial.id}
                  className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CategoryIcon className="h-5 w-5 text-teal-400" />
                          <h3 className="text-white font-semibold text-xl">{trial.title}</h3>
                          {trial.featured && (
                            <Badge className="bg-orange-600/20 text-orange-300 border-orange-500/20">
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <Badge className={getStatusColor(trial.status)}>{trial.status}</Badge>
                          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">{trial.phase}</Badge>
                          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">{trial.category}</Badge>
                        </div>

                        <p className="text-gray-300 mb-4 leading-relaxed">{trial.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-300">{trial.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-300">{trial.duration}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-green-400" />
                            <span className="text-green-400">${trial.compensation.toLocaleString()} compensation</span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300 text-sm">Enrollment Progress</span>
                            <span className="text-gray-300 text-sm">
                              {trial.participants.enrolled}/{trial.participants.target} participants
                            </span>
                          </div>
                          <Progress value={enrollmentProgress} className="w-full" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="text-white font-medium text-sm mb-2">Key Requirements:</h4>
                            <div className="space-y-1">
                              <div className="text-sm text-gray-400">Age: {trial.eligibility.ageRange}</div>
                              {trial.eligibility.requirements.slice(0, 2).map((req, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-gray-400">
                                  <CheckCircle className="h-3 w-3 text-green-400" />
                                  <span>{req}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-white font-medium text-sm mb-2">Study Details:</h4>
                            <div className="space-y-1 text-sm text-gray-400">
                              <div>
                                <strong>Intervention:</strong> {trial.intervention}
                              </div>
                              <div>
                                <strong>Primary Endpoint:</strong> {trial.primaryEndpoint}
                              </div>
                              <div>
                                <strong>Completion:</strong> {trial.estimatedCompletion}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-400">Sponsored by {trial.sponsor}</div>

                      <div className="flex gap-3">
                        <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                          <FileText className="h-4 w-4 mr-1" />
                          Learn More
                        </Button>
                        <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                          <Users className="h-4 w-4 mr-1" />
                          Apply Now
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* My Applications */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myApplications.length > 0 ? (
                <div className="space-y-4">
                  {myApplications.map((app) => (
                    <div key={app.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium text-sm">{app.title}</h4>
                        <Badge className={getStatusColor(app.status)}>{app.status}</Badge>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">Applied: {app.appliedDate}</div>
                      <div className="text-sm text-gray-300 mb-3">{app.nextStep}</div>
                      <Progress value={app.progress} className="w-full" />
                    </div>
                  ))}
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">View All Applications</Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No applications yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="h-5 w-5" />
                Participation Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">Compensation for time</span>
                </div>
                <div className="flex items-center gap-2">
                  <Microscope className="h-4 w-4 text-blue-400" />
                  <span className="text-gray-300">Free comprehensive testing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-400" />
                  <span className="text-gray-300">Expert medical monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-gray-300">Early access to treatments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  <span className="text-gray-300">Contribute to science</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eligibility Checker */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Eligibility Checker</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Age</label>
                  <Input
                    type="number"
                    placeholder="Enter your age"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Location</label>
                  <Input placeholder="City, State" className="bg-gray-700 border-gray-600 text-white" />
                </div>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Check Eligibility
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Research Alerts */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Research Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-blue-500/20 bg-blue-500/10 mb-4">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200 text-sm">
                  Get notified when new trials match your profile and interests.
                </AlertDescription>
              </Alert>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Set Up Alerts</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
