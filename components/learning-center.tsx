"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  BookOpen,
  Play,
  Clock,
  Users,
  Star,
  Award,
  CheckCircle,
  Lock,
  Search,
  Lightbulb,
  Brain,
  Shield,
  Zap,
  TrendingUp,
  FileText,
  Download,
} from "lucide-react"

const courses = [
  {
    id: 1,
    title: "Longevity 101: Complete Beginner's Guide",
    description: "Everything you need to know to start your longevity journey safely and effectively",
    instructor: "Dr. Sarah Martinez",
    duration: "4 hours",
    lessons: 12,
    students: 2847,
    rating: 4.9,
    level: "Beginner",
    category: "Fundamentals",
    progress: 0,
    price: "Free",
    thumbnail: "/placeholder.svg?height=200&width=300",
    topics: ["Aging Science", "Safety First", "Basic Compounds", "Lifestyle Factors"],
    isEnrolled: false,
    isPremium: false,
  },
  {
    id: 2,
    title: "Understanding NAD+ and Its Precursors",
    description: "Deep dive into NAD+ biology, NMN, NR, and how to optimize cellular energy production",
    instructor: "Prof. Michael Chen",
    duration: "3 hours",
    lessons: 8,
    students: 1234,
    rating: 4.8,
    level: "Intermediate",
    category: "Compounds",
    progress: 65,
    price: "Premium",
    thumbnail: "/placeholder.svg?height=200&width=300",
    topics: ["NAD+ Biology", "NMN vs NR", "Dosing Strategies", "Biomarker Tracking"],
    isEnrolled: true,
    isPremium: true,
  },
  {
    id: 3,
    title: "Senolytic Compounds: Clearing Cellular Damage",
    description: "Learn about senescent cells and compounds that help remove them for healthy aging",
    instructor: "Dr. Lisa Thompson",
    duration: "2.5 hours",
    lessons: 6,
    students: 892,
    rating: 4.7,
    level: "Advanced",
    category: "Compounds",
    progress: 0,
    price: "Premium",
    thumbnail: "/placeholder.svg?height=200&width=300",
    topics: ["Senescent Cells", "Quercetin", "Dasatinib", "Safety Protocols"],
    isEnrolled: false,
    isPremium: true,
  },
  {
    id: 4,
    title: "Biomarker Tracking for Longevity",
    description: "Which biomarkers to track, how to interpret results, and optimize your health metrics",
    instructor: "Dr. James Wilson",
    duration: "3.5 hours",
    lessons: 10,
    students: 1567,
    rating: 4.8,
    level: "Intermediate",
    category: "Tracking",
    progress: 0,
    price: "Free",
    thumbnail: "/placeholder.svg?height=200&width=300",
    topics: ["Key Biomarkers", "Lab Testing", "Interpretation", "Optimization"],
    isEnrolled: false,
    isPremium: false,
  },
  {
    id: 5,
    title: "Safety Protocols and Risk Management",
    description: "Essential safety knowledge for anyone experimenting with longevity compounds",
    instructor: "Dr. Sarah Martinez",
    duration: "2 hours",
    lessons: 5,
    students: 3421,
    rating: 5.0,
    level: "Beginner",
    category: "Safety",
    progress: 100,
    price: "Free",
    thumbnail: "/placeholder.svg?height=200&width=300",
    topics: ["Risk Assessment", "Drug Interactions", "Side Effects", "When to Stop"],
    isEnrolled: true,
    isPremium: false,
  },
  {
    id: 6,
    title: "Advanced Compound Stacking Strategies",
    description: "Learn how to safely combine multiple compounds for synergistic effects",
    instructor: "Prof. David Kim",
    duration: "4.5 hours",
    lessons: 15,
    students: 567,
    rating: 4.6,
    level: "Advanced",
    category: "Advanced",
    progress: 0,
    price: "Premium",
    thumbnail: "/placeholder.svg?height=200&width=300",
    topics: ["Synergies", "Timing", "Cycling", "Monitoring"],
    isEnrolled: false,
    isPremium: true,
  },
]

const glossaryTerms = [
  {
    term: "NAD+",
    definition:
      "Nicotinamide adenine dinucleotide - a coenzyme essential for cellular energy production and DNA repair",
    simpleExplanation:
      "Think of NAD+ as the fuel that powers your cellular engines. As we age, we have less of it, which is why NAD+ boosters like NMN are popular.",
    category: "Biochemistry",
    relatedTerms: ["NMN", "NR", "Sirtuins"],
  },
  {
    term: "Senescent Cells",
    definition: "Cells that have stopped dividing but remain metabolically active, secreting inflammatory factors",
    simpleExplanation:
      "These are 'zombie cells' - they're damaged and should die, but instead they stick around and cause inflammation. Removing them may help with aging.",
    category: "Cell Biology",
    relatedTerms: ["Senolytics", "SASP", "Cellular Aging"],
  },
  {
    term: "Autophagy",
    definition: "The cellular process of breaking down and recycling damaged proteins and organelles",
    simpleExplanation:
      "Your cells' cleanup crew. Autophagy helps cells remove damaged parts and recycle them into useful components.",
    category: "Cell Biology",
    relatedTerms: ["Spermidine", "Fasting", "mTOR"],
  },
  {
    term: "Biomarkers",
    definition: "Measurable indicators of biological processes, conditions, or diseases",
    simpleExplanation:
      "Numbers from blood tests or other measurements that tell you about your health, like cholesterol or blood sugar levels.",
    category: "Health Metrics",
    relatedTerms: ["Lab Tests", "Health Tracking", "Optimization"],
  },
  {
    term: "Hormesis",
    definition: "A beneficial response to low doses of stress or toxins that would be harmful in larger amounts",
    simpleExplanation:
      "The idea that small amounts of stress can make you stronger - like how exercise stresses your muscles to make them grow.",
    category: "Biology",
    relatedTerms: ["Exercise", "Fasting", "Heat Shock"],
  },
]

const articles = [
  {
    id: 1,
    title: "The Complete Guide to Starting Your Longevity Journey",
    excerpt: "A comprehensive roadmap for beginners looking to optimize their healthspan and lifespan safely",
    author: "Dr. Sarah Martinez",
    readTime: "12 min read",
    category: "Beginner Guide",
    publishDate: "2024-01-15",
    tags: ["beginner", "safety", "overview"],
    isBookmarked: false,
  },
  {
    id: 2,
    title: "NMN vs NR: Which NAD+ Precursor is Right for You?",
    excerpt: "Comparing the two most popular NAD+ boosters based on current research and user experiences",
    author: "Prof. Michael Chen",
    readTime: "8 min read",
    category: "Compounds",
    publishDate: "2024-01-10",
    tags: ["NMN", "NR", "NAD+", "comparison"],
    isBookmarked: true,
  },
  {
    id: 3,
    title: "Understanding Your Longevity Biomarkers",
    excerpt: "Which blood tests to get, how to interpret results, and what changes to look for over time",
    author: "Dr. James Wilson",
    readTime: "15 min read",
    category: "Health Tracking",
    publishDate: "2024-01-08",
    tags: ["biomarkers", "testing", "health"],
    isBookmarked: false,
  },
]

export function LearningCenter() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedLevel, setSelectedLevel] = useState("All")
  const [selectedGlossaryCategory, setSelectedGlossaryCategory] = useState("All")

  const categories = ["All", "Fundamentals", "Compounds", "Safety", "Tracking", "Advanced"]
  const levels = ["All", "Beginner", "Intermediate", "Advanced"]
  const glossaryCategories = ["All", "Biochemistry", "Cell Biology", "Health Metrics", "Biology"]

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || course.category === selectedCategory
    const matchesLevel = selectedLevel === "All" || course.level === selectedLevel
    return matchesSearch && matchesCategory && matchesLevel
  })

  const filteredGlossary = glossaryTerms.filter((term) => {
    const matchesSearch =
      term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedGlossaryCategory === "All" || term.category === selectedGlossaryCategory
    return matchesSearch && matchesCategory
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Intermediate":
        return "bg-blue-600/20 text-blue-300 border-blue-500/20"
      case "Advanced":
        return "bg-purple-600/20 text-purple-300 border-purple-500/20"
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Fundamentals":
        return BookOpen
      case "Compounds":
        return Zap
      case "Safety":
        return Shield
      case "Tracking":
        return TrendingUp
      case "Advanced":
        return Brain
      default:
        return BookOpen
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Learning Center</h1>
        <p className="text-gray-400 text-lg mb-4">
          Master longevity science with expert-created courses, articles, and comprehensive resources
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <BookOpen className="h-3 w-3 mr-1" />
            Expert Created
          </Badge>
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Beginner Friendly
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <Award className="h-3 w-3 mr-1" />
            Certificates
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-8">
          <TabsTrigger value="courses" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Courses
          </TabsTrigger>
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="glossary" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Glossary
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          {/* Search and Filters */}
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search courses..."
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
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                >
                  {levels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const CategoryIcon = getCategoryIcon(course.category)

              return (
                <Card
                  key={course.id}
                  className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300 group"
                >
                  <div className="relative">
                    <img
                      src={course.thumbnail || "/placeholder.svg"}
                      alt={course.title}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    {course.isPremium && (
                      <Badge className="absolute top-2 right-2 bg-yellow-600/20 text-yellow-300 border-yellow-500/20">
                        <Award className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                    {course.progress > 0 && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <Progress value={course.progress} className="w-full h-2" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <CategoryIcon className="h-4 w-4 text-teal-400" />
                      <Badge className={getLevelColor(course.level)} variant="outline">
                        {course.level}
                      </Badge>
                      <Badge className="bg-gray-600/20 text-gray-300 border-gray-500/20" variant="outline">
                        {course.category}
                      </Badge>
                    </div>

                    <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-teal-400 transition-colors">
                      {course.title}
                    </h3>

                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{course.description}</p>

                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Play className="h-4 w-4" />
                        <span>{course.lessons} lessons</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{course.students}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-white font-medium">{course.rating}</span>
                      </div>
                      <span className="text-teal-400 font-medium">{course.price}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {course.topics.slice(0, 3).map((topic, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>

                    <Button
                      className={`w-full ${course.isEnrolled ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700"}`}
                    >
                      {course.isEnrolled ? (
                        course.progress === 100 ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Continue ({course.progress}%)
                          </>
                        )
                      ) : course.isPremium ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Upgrade to Access
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start Course
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="articles">
          <div className="space-y-6">
            {articles.map((article) => (
              <Card
                key={article.id}
                className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">{article.category}</Badge>
                        <span className="text-gray-400 text-sm">{article.readTime}</span>
                      </div>

                      <h3 className="text-white font-semibold text-xl mb-2 hover:text-teal-400 cursor-pointer">
                        {article.title}
                      </h3>

                      <p className="text-gray-400 mb-3">{article.excerpt}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>By {article.author}</span>
                        <span>•</span>
                        <span>{article.publishDate}</span>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-teal-400">
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="glossary">
          {/* Glossary Search */}
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search terms..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <select
                  value={selectedGlossaryCategory}
                  onChange={(e) => setSelectedGlossaryCategory(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                >
                  {glossaryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Glossary Terms */}
          <div className="space-y-4">
            {filteredGlossary.map((term, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold text-xl mb-1">{term.term}</h3>
                      <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">{term.category}</Badge>
                    </div>
                  </div>

                  <Tabs defaultValue="simple" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-gray-600 mb-4">
                      <TabsTrigger value="simple">Simple Explanation</TabsTrigger>
                      <TabsTrigger value="technical">Technical Definition</TabsTrigger>
                    </TabsList>

                    <TabsContent value="simple">
                      <div className="bg-teal-900/20 border border-teal-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-teal-400" />
                          <span className="text-teal-300 font-medium">Simple Explanation:</span>
                        </div>
                        <p className="text-gray-300 leading-relaxed">{term.simpleExplanation}</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="technical">
                      <p className="text-gray-300 leading-relaxed mb-4">{term.definition}</p>
                    </TabsContent>
                  </Tabs>

                  {term.relatedTerms.length > 0 && (
                    <div className="mt-4">
                      <span className="text-gray-400 text-sm font-medium">Related terms: </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {term.relatedTerms.map((relatedTerm, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:border-teal-500 hover:text-teal-300 cursor-pointer"
                          >
                            {relatedTerm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-600 rounded-full p-3">
                    <Download className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Safety Checklist</h3>
                    <p className="text-gray-400 text-sm">PDF Guide</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                  Comprehensive safety checklist for longevity compound experimentation
                </p>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-600 rounded-full p-3">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Biomarker Tracker</h3>
                    <p className="text-gray-400 text-sm">Excel Template</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                  Track your key longevity biomarkers over time with this comprehensive template
                </p>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-600 rounded-full p-3">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Research Library</h3>
                    <p className="text-gray-400 text-sm">Curated Papers</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                  Access our curated collection of the most important longevity research papers
                </p>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Browse
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
