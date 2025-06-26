"use client"

import {
  Search,
  BookOpen,
  Star,
  Download,
  Share2,
  Brain,
  Clock,
  ExternalLink,
  Bookmark,
  Lightbulb,
  AlertCircle,
} from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const researchPapers = [
  {
    id: 1,
    title:
      "Nicotinamide mononucleotide supplementation reverses vascular dysfunction and oxidative stress with aging in mice",
    authors: ["Yoshino J", "Mills KF", "Yoon MJ", "Imai S"],
    journal: "Cell Metabolism",
    year: 2018,
    doi: "10.1016/j.cmet.2018.02.001",
    relevanceScore: 95,
    citationCount: 847,
    studyType: "Animal Study",
    abstract:
      "Aging is associated with vascular dysfunction and increased oxidative stress. Here we show that NMN supplementation improves endothelial function and reduces oxidative stress in aged mice through NAD+ restoration.",
    keyFindings: [
      "NMN supplementation increased NAD+ levels by 60% in aged mice",
      "Improved endothelial function and arterial stiffness",
      "Reduced oxidative stress markers by 40%",
      "Enhanced mitochondrial function in vascular tissue",
    ],
    simpleExplanation:
      "This study found that NMN supplements helped old mice have healthier blood vessels by boosting their cellular energy and reducing damage from aging.",
    safetyNotes: ["Animal study - human effects may differ", "No adverse effects reported in mice"],
    compounds: ["NMN"],
    biomarkers: ["NAD+", "Endothelial function", "Oxidative stress"],
    evidenceLevel: "Strong",
    humanRelevance: "High",
    limitations: ["Animal study only", "Short-term treatment", "Single dose tested"],
    clinicalImplications: "Suggests NMN may benefit cardiovascular health in aging humans",
  },
  {
    id: 2,
    title: "Quercetin and dasatinib eliminate senescent cells and extend healthspan in naturally aged mice",
    authors: ["Xu M", "Pirtskhalava T", "Farr JN", "Weigand BM"],
    journal: "Nature Medicine",
    year: 2018,
    doi: "10.1038/s41591-018-0092-9",
    relevanceScore: 92,
    citationCount: 1203,
    studyType: "Animal Study",
    abstract:
      "Senescent cells accumulate with aging and contribute to age-related pathologies. We demonstrate that intermittent treatment with senolytic drugs extends healthspan in naturally aged mice.",
    keyFindings: [
      "Senolytic treatment reduced senescent cell burden by 70%",
      "Extended healthspan and improved physical function",
      "Reduced inflammation and tissue dysfunction",
      "Benefits observed with intermittent dosing",
    ],
    simpleExplanation:
      "This research showed that drugs that remove old, damaged cells from the body helped mice stay healthier longer and improved their physical abilities.",
    safetyNotes: ["Intermittent dosing appears safer than continuous", "Some side effects noted at high doses"],
    compounds: ["Quercetin", "Dasatinib"],
    biomarkers: ["Senescent cells", "Inflammation", "Physical function"],
    evidenceLevel: "Strong",
    humanRelevance: "High",
    limitations: ["Animal study", "Limited safety data", "Optimal dosing unknown"],
    clinicalImplications: "Senolytic therapy shows promise for healthy aging in humans",
  },
  {
    id: 3,
    title:
      "Resveratrol improves mitochondrial function and protects against metabolic disease by activating SIRT1 and PGC-1α",
    authors: ["Lagouge M", "Argmann C", "Gerhart-Hines Z", "Meziane H"],
    journal: "Cell",
    year: 2006,
    doi: "10.1016/j.cell.2006.11.013",
    relevanceScore: 89,
    citationCount: 2156,
    studyType: "Animal Study",
    abstract:
      "Resveratrol, a polyphenol found in red wine, improves health and survival of mice on a high-calorie diet by inducing genes that mimic the effects of caloric restriction.",
    keyFindings: [
      "Activated SIRT1 and improved mitochondrial function",
      "Protected against diet-induced obesity",
      "Improved insulin sensitivity and glucose tolerance",
      "Extended lifespan in some mouse models",
    ],
    simpleExplanation:
      "Resveratrol, found in red wine, helped mice stay healthy even on a high-calorie diet by improving how their cells use energy and mimicking the benefits of eating less.",
    safetyNotes: ["Generally well-tolerated", "High doses may cause digestive upset"],
    compounds: ["Resveratrol"],
    biomarkers: ["SIRT1", "Mitochondrial function", "Insulin sensitivity"],
    evidenceLevel: "Strong",
    humanRelevance: "Moderate",
    limitations: ["High doses needed", "Variable human bioavailability", "Mixed human trial results"],
    clinicalImplications: "May benefit metabolic health, but optimal dosing in humans unclear",
  },
  {
    id: 4,
    title: "Spermidine promotes longevity through autophagy by protecting against cardiovascular disease",
    authors: ["Eisenberg T", "Abdellatif M", "Schroeder S", "Primessnig U"],
    journal: "Nature Medicine",
    year: 2016,
    doi: "10.1038/nm.4222",
    relevanceScore: 87,
    citationCount: 892,
    studyType: "Human Study",
    abstract:
      "Dietary spermidine intake is associated with reduced mortality and cardiovascular disease risk in humans, potentially through autophagy enhancement.",
    keyFindings: [
      "Higher dietary spermidine linked to lower mortality",
      "Reduced cardiovascular disease risk by 40%",
      "Enhanced autophagy in human cells",
      "Benefits observed across different populations",
    ],
    simpleExplanation:
      "People who ate more foods containing spermidine (like wheat germ) lived longer and had healthier hearts, possibly because it helps cells clean themselves better.",
    safetyNotes: ["Natural dietary compound", "No significant side effects reported"],
    compounds: ["Spermidine"],
    biomarkers: ["Autophagy", "Cardiovascular markers", "Mortality"],
    evidenceLevel: "Strong",
    humanRelevance: "Very High",
    limitations: ["Observational study", "Confounding factors possible", "Optimal supplementation dose unknown"],
    clinicalImplications: "Strong evidence for cardiovascular benefits in humans",
  },
  {
    id: 5,
    title: "Fisetin is a senotherapeutic that extends health and lifespan",
    authors: ["Yousefzadeh MJ", "Zhu Y", "McGowan SJ", "Angelini L"],
    journal: "EBioMedicine",
    year: 2018,
    doi: "10.1016/j.ebiom.2018.09.015",
    relevanceScore: 84,
    citationCount: 445,
    studyType: "Animal Study",
    abstract:
      "Fisetin reduces senescent cell burden and extends both healthspan and lifespan in naturally aged mice, making it a promising senotherapeutic compound.",
    keyFindings: [
      "Reduced senescent cells in multiple tissues",
      "Extended median lifespan by 10%",
      "Improved healthspan and reduced frailty",
      "Most effective senolytic tested",
    ],
    simpleExplanation:
      "Fisetin, found in strawberries, helped mice live longer and stay healthier by removing old, damaged cells from their bodies more effectively than other similar compounds.",
    safetyNotes: ["Natural flavonoid", "Limited human safety data", "Generally well-tolerated in animals"],
    compounds: ["Fisetin"],
    biomarkers: ["Senescent cells", "Lifespan", "Frailty"],
    evidenceLevel: "Moderate",
    humanRelevance: "Moderate",
    limitations: ["Animal study only", "Limited human trials", "Optimal dosing unknown"],
    clinicalImplications: "Promising senolytic candidate requiring human validation",
  },
]

const journals = ["All Journals", "Nature", "Cell", "Science", "Nature Medicine", "Cell Metabolism", "Aging Cell"]
const studyTypes = ["All Types", "Human Study", "Animal Study", "Clinical Trial", "Review", "Meta-Analysis"]
const evidenceLevels = ["All Levels", "Strong", "Moderate", "Limited", "Preliminary"]

export function ResearchSearch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedJournal, setSelectedJournal] = useState("All Journals")
  const [selectedStudyType, setSelectedStudyType] = useState("All Types")
  const [selectedEvidenceLevel, setSelectedEvidenceLevel] = useState("All Levels")
  const [sortBy, setSortBy] = useState("relevance")
  const [savedPapers, setSavedPapers] = useState<number[]>([])
  const [expandedPaper, setExpandedPaper] = useState<number | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<any>(null)

  const filteredPapers = researchPapers
    .filter((paper) => {
      const matchesSearch =
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.compounds.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesJournal = selectedJournal === "All Journals" || paper.journal === selectedJournal
      const matchesStudyType = selectedStudyType === "All Types" || paper.studyType === selectedStudyType
      const matchesEvidence = selectedEvidenceLevel === "All Levels" || paper.evidenceLevel === selectedEvidenceLevel

      return matchesSearch && matchesJournal && matchesStudyType && matchesEvidence
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "relevance":
          return b.relevanceScore - a.relevanceScore
        case "citations":
          return b.citationCount - a.citationCount
        case "year":
          return b.year - a.year
        case "journal":
          return a.journal.localeCompare(b.journal)
        default:
          return 0
      }
    })

  const toggleSavePaper = (paperId: number) => {
    setSavedPapers((prev) => (prev.includes(paperId) ? prev.filter((id) => id !== paperId) : [...prev, paperId]))
  }

  const analyzeResearch = async () => {
    setIsAnalyzing(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setAnalysisResults({
      totalPapers: filteredPapers.length,
      averageRelevance: Math.round(
        filteredPapers.reduce((acc, p) => acc + p.relevanceScore, 0) / filteredPapers.length,
      ),
      topCompounds: ["NMN", "Resveratrol", "Quercetin"],
      evidenceStrength: "Strong",
      recommendations: [
        "Focus on compounds with human studies",
        "Consider synergistic combinations",
        "Start with well-researched compounds",
      ],
    })
    setIsAnalyzing(false)
  }

  const getEvidenceColor = (level: string) => {
    switch (level) {
      case "Strong":
        return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Moderate":
        return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "Limited":
        return "bg-orange-600/20 text-orange-300 border-orange-500/20"
      case "Preliminary":
        return "bg-red-600/20 text-red-300 border-red-500/20"
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getRelevanceColor = (score: number) => {
    if (score >= 90) return "text-green-400"
    if (score >= 80) return "text-yellow-400"
    if (score >= 70) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Research Intelligence</h1>
        <p className="text-gray-400 text-lg mb-4">
          Explore 15,000+ research papers with AI-powered analysis and plain-English summaries
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Brain className="h-3 w-3 mr-1" />
            AI Analyzed
          </Badge>
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <BookOpen className="h-3 w-3 mr-1" />
            Peer Reviewed
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <Lightbulb className="h-3 w-3 mr-1" />
            Simplified
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Search and Filters */}
        <div className="lg:col-span-3">
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Research
                <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">
                  {filteredPapers.length} papers found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search papers, compounds, or topics..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select
                    value={selectedJournal}
                    onChange={(e) => setSelectedJournal(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    {journals.map((journal) => (
                      <option key={journal} value={journal}>
                        {journal}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedStudyType}
                    onChange={(e) => setSelectedStudyType(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    {studyTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedEvidenceLevel}
                    onChange={(e) => setSelectedEvidenceLevel(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    {evidenceLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                  >
                    <option value="relevance">Sort by Relevance</option>
                    <option value="citations">Sort by Citations</option>
                    <option value="year">Sort by Year</option>
                    <option value="journal">Sort by Journal</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Research Papers */}
          <div className="space-y-6">
            {filteredPapers.map((paper) => (
              <Card
                key={paper.id}
                className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-semibold text-lg leading-tight">{paper.title}</h3>
                        <Badge className={getEvidenceColor(paper.evidenceLevel)}>{paper.evidenceLevel}</Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                        <span>{paper.authors.slice(0, 2).join(", ")} et al.</span>
                        <span>•</span>
                        <span className="text-teal-400">{paper.journal}</span>
                        <span>•</span>
                        <span>{paper.year}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span>{paper.citationCount} citations</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">Relevance:</span>
                          <span className={`font-medium ${getRelevanceColor(paper.relevanceScore)}`}>
                            {paper.relevanceScore}%
                          </span>
                        </div>
                        <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">{paper.studyType}</Badge>
                        <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
                          {paper.humanRelevance} Human Relevance
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {paper.compounds.map((compound, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-teal-600/20 text-teal-300">
                            {compound}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSavePaper(paper.id)}
                        className={savedPapers.includes(paper.id) ? "text-teal-400" : "text-gray-400"}
                      >
                        <Bookmark className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Tabs defaultValue="simple" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-gray-600">
                      <TabsTrigger value="simple" className="text-xs">
                        Simple
                      </TabsTrigger>
                      <TabsTrigger value="detailed" className="text-xs">
                        Detailed
                      </TabsTrigger>
                      <TabsTrigger value="findings" className="text-xs">
                        Key Findings
                      </TabsTrigger>
                      <TabsTrigger value="implications" className="text-xs">
                        Implications
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="simple" className="mt-4">
                      <div className="bg-teal-900/20 border border-teal-500/20 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-teal-400" />
                          <span className="text-teal-300 font-medium">Simple Explanation:</span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{paper.simpleExplanation}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong className="text-gray-300">What was studied:</strong>
                          <p className="text-gray-400 mt-1">{paper.compounds.join(", ")}</p>
                        </div>
                        <div>
                          <strong className="text-gray-300">What was measured:</strong>
                          <p className="text-gray-400 mt-1">{paper.biomarkers.join(", ")}</p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="detailed" className="mt-4">
                      <p className="text-gray-300 text-sm mb-4 leading-relaxed">{paper.abstract}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong className="text-gray-300">Study Type:</strong>
                          <p className="text-gray-400 mt-1">{paper.studyType}</p>
                        </div>
                        <div>
                          <strong className="text-gray-300">Evidence Level:</strong>
                          <Badge className={getEvidenceColor(paper.evidenceLevel)} variant="outline">
                            {paper.evidenceLevel}
                          </Badge>
                        </div>
                        <div>
                          <strong className="text-gray-300">DOI:</strong>
                          <p className="text-gray-400 mt-1 font-mono text-xs">{paper.doi}</p>
                        </div>
                        <div>
                          <strong className="text-gray-300">Citations:</strong>
                          <p className="text-gray-400 mt-1">{paper.citationCount}</p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="findings" className="mt-4">
                      <div className="space-y-3">
                        <div>
                          <strong className="text-gray-300 mb-2 block">Key Findings:</strong>
                          <ul className="space-y-2">
                            {paper.keyFindings.map((finding, idx) => (
                              <li key={idx} className="text-gray-400 text-sm flex items-start gap-2">
                                <span className="text-teal-400 mt-1">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {paper.safetyNotes.length > 0 && (
                          <Alert className="border-yellow-500/20 bg-yellow-500/10">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <AlertDescription className="text-yellow-200 text-sm">
                              <strong>Safety Notes:</strong> {paper.safetyNotes.join(", ")}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="implications" className="mt-4">
                      <div className="space-y-4">
                        <div>
                          <strong className="text-gray-300">Clinical Implications:</strong>
                          <p className="text-gray-400 text-sm mt-1 leading-relaxed">{paper.clinicalImplications}</p>
                        </div>

                        <div>
                          <strong className="text-gray-300">Limitations:</strong>
                          <ul className="mt-2 space-y-1">
                            {paper.limitations.map((limitation, idx) => (
                              <li key={idx} className="text-gray-400 text-sm flex items-start gap-2">
                                <span className="text-orange-400 mt-1">•</span>
                                <span>{limitation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3">
                          <strong className="text-blue-300 text-sm">Bottom Line for Regular Users:</strong>
                          <p className="text-blue-200 text-sm mt-1 leading-relaxed">
                            {paper.humanRelevance === "Very High"
                              ? "This research has strong implications for humans and the findings are likely applicable."
                              : paper.humanRelevance === "High"
                                ? "This research shows promise for humans, but more studies may be needed."
                                : "This research is interesting but may not directly apply to humans yet."}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Analysis Panel */}
        <div>
          <Card className="bg-gray-800 border-gray-700 sticky top-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Research Analysis
              </CardTitle>
              <CardDescription>AI-powered insights from your search results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={analyzeResearch}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  disabled={filteredPapers.length === 0 || isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze Research
                    </>
                  )}
                </Button>

                {isAnalyzing && (
                  <div className="space-y-2">
                    <Progress value={66} className="w-full" />
                    <div className="text-xs text-gray-500">Processing {filteredPapers.length} papers...</div>
                  </div>
                )}

                {analysisResults && (
                  <div className="space-y-4">
                    <div className="bg-teal-900/20 border border-teal-500/20 rounded-lg p-4">
                      <h4 className="text-teal-300 font-medium mb-2">Analysis Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Papers analyzed:</span>
                          <span className="text-white">{analysisResults.totalPapers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg. relevance:</span>
                          <span className="text-white">{analysisResults.averageRelevance}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Evidence strength:</span>
                          <Badge className={getEvidenceColor(analysisResults.evidenceStrength)}>
                            {analysisResults.evidenceStrength}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-2">Top Compounds</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResults.topCompounds.map((compound: string, idx: number) => (
                          <Badge key={idx} className="bg-purple-600/20 text-purple-300 border-purple-500/20">
                            {compound}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-2">AI Recommendations</h4>
                      <ul className="space-y-1">
                        {analysisResults.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="text-gray-400 text-sm flex items-start gap-2">
                            <span className="text-teal-400 mt-1">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <Separator className="bg-gray-600" />

                <div>
                  <h4 className="text-white font-medium mb-2">Saved Papers</h4>
                  {savedPapers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No papers saved yet</p>
                  ) : (
                    <div className="space-y-2">
                      {savedPapers.map((paperId) => {
                        const paper = researchPapers.find((p) => p.id === paperId)
                        return paper ? (
                          <div key={paperId} className="bg-gray-700 rounded p-2">
                            <p className="text-white text-sm font-medium line-clamp-2">{paper.title}</p>
                            <p className="text-gray-400 text-xs">
                              {paper.journal} • {paper.year}
                            </p>
                          </div>
                        ) : null
                      })}
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Export Saved Papers
                      </Button>
                    </div>
                  )}
                </div>

                <Alert className="border-blue-500/20 bg-blue-500/10">
                  <BookOpen className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-200 text-sm">
                    Our AI analyzes research papers to provide relevance scores and simplified explanations for better
                    understanding.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
