"use client"

import { 
  Search, 
  Filter, 
  BookOpen, 
  TrendingUp,
  Users,
  Calendar,
  Star,
  ExternalLink,
  Download,
  Share2,
  Eye,
  Brain,
  Heart,
  Activity,
  Target
} from 'lucide-react'
import React, { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ResearchPaper {
  id: string
  title: string
  authors: string[]
  journal: string
  publicationDate: string
  abstract: string
  category: 'longevity' | 'epigenetics' | 'metabolism' | 'cognitive' | 'physical'
  impact: 'high' | 'medium' | 'low'
  citations: number
  doi: string
  tags: string[]
}

interface ResearchProject {
  id: string
  title: string
  description: string
  status: 'active' | 'completed' | 'planned'
  participants: number
  duration: string
  category: string
  leadResearcher: string
}

export function ResearchHub() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'papers' | 'projects' | 'trends'>('papers')

  // Mock research papers
  const [papers] = useState<ResearchPaper[]>([
    {
      id: '1',
      title: 'NAD+ Precursors and Longevity: A Comprehensive Review',
      authors: ['Dr. Sarah Chen', 'Dr. Marcus Rodriguez', 'Dr. Emily Watson'],
      journal: 'Nature Aging',
      publicationDate: '2024-01-15',
      abstract: 'This comprehensive review examines the role of NAD+ precursors in extending lifespan and improving healthspan across multiple species.',
      category: 'longevity',
      impact: 'high',
      citations: 156,
      doi: '10.1038/s43587-024-00567-8',
      tags: ['NAD+', 'Longevity', 'Metabolism', 'Review']
    },
    {
      id: '2',
      title: 'Epigenetic Reprogramming for Age Reversal',
      authors: ['Dr. David Thompson', 'Dr. Lisa Park'],
      journal: 'Cell',
      publicationDate: '2024-01-10',
      abstract: 'Novel approaches to epigenetic reprogramming show promise for reversing cellular aging and extending healthy lifespan.',
      category: 'epigenetics',
      impact: 'high',
      citations: 89,
      doi: '10.1016/j.cell.2024.01.045',
      tags: ['Epigenetics', 'Reprogramming', 'Aging', 'Cellular']
    },
    {
      id: '3',
      title: 'Metabolic Optimization Through Fasting',
      authors: ['Dr. James Wilson', 'Dr. Maria Garcia'],
      journal: 'Science Translational Medicine',
      publicationDate: '2024-01-05',
      abstract: 'Intermittent fasting protocols demonstrate significant improvements in metabolic health and longevity markers.',
      category: 'metabolism',
      impact: 'medium',
      citations: 67,
      doi: '10.1126/scitranslmed.abc1234',
      tags: ['Fasting', 'Metabolism', 'Health', 'Protocol']
    }
  ])

  // Mock research projects
  const [projects] = useState<ResearchProject[]>([
    {
      id: '1',
      title: 'Longevity Biomarker Discovery',
      description: 'Identifying novel biomarkers for biological age and longevity prediction',
      status: 'active',
      participants: 150,
      duration: '2 years',
      category: 'longevity',
      leadResearcher: 'Dr. Sarah Chen'
    },
    {
      id: '2',
      title: 'Epigenetic Clock Validation',
      description: 'Validating epigenetic clocks across diverse populations',
      status: 'active',
      participants: 200,
      duration: '18 months',
      category: 'epigenetics',
      leadResearcher: 'Dr. Marcus Rodriguez'
    },
    {
      id: '3',
      title: 'Cognitive Enhancement Protocols',
      description: 'Developing protocols for cognitive enhancement and brain health',
      status: 'planned',
      participants: 100,
      duration: '3 years',
      category: 'cognitive',
      leadResearcher: 'Dr. Emily Watson'
    }
  ])

  const filteredPapers = papers.filter(paper => {
    const matchesSearch = paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         paper.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         paper.authors.some(author => author.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || paper.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'longevity': return <Target className="w-4 h-4" />
      case 'epigenetics': return <Brain className="w-4 h-4" />
      case 'metabolism': return <Activity className="w-4 h-4" />
      case 'cognitive': return <Brain className="w-4 h-4" />
      case 'physical': return <Heart className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'planned': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Research Hub</h1>
          <p className="text-gray-600 mt-1">Latest longevity research and clinical studies</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'papers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('papers')}
          >
            Papers
          </Button>
          <Button
            variant={viewMode === 'projects' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('projects')}
          >
            Projects
          </Button>
          <Button
            variant={viewMode === 'trends' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('trends')}
          >
            Trends
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search papers, authors, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All
              </Button>
              <Button
                variant={selectedCategory === 'longevity' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('longevity')}
                className="flex items-center gap-1"
              >
                <Target className="w-3 h-3" />
                Longevity
              </Button>
              <Button
                variant={selectedCategory === 'epigenetics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('epigenetics')}
                className="flex items-center gap-1"
              >
                <Brain className="w-3 h-3" />
                Epigenetics
              </Button>
              <Button
                variant={selectedCategory === 'metabolism' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('metabolism')}
                className="flex items-center gap-1"
              >
                <Activity className="w-3 h-3" />
                Metabolism
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Papers View */}
      {viewMode === 'papers' && (
        <div className="space-y-4">
          {filteredPapers.map((paper) => (
            <Card key={paper.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryIcon(paper.category)}
                      <h3 className="font-semibold text-lg">{paper.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {paper.authors.join(', ')} • {paper.journal} • {paper.publicationDate}
                    </p>
                    <p className="text-gray-700 mb-3">{paper.abstract}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {paper.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <Badge className={getImpactColor(paper.impact)}>
                      {paper.impact} impact
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Star className="w-4 h-4" />
                      {paper.citations} citations
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    DOI: {paper.doi}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Read
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Projects View */}
      {viewMode === 'projects' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{project.title}</h3>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{project.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span>{project.participants} participants</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{project.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span>Lead: {project.leadResearcher}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full mt-4" variant="outline">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Trends View */}
      {viewMode === 'trends' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-medium">Epigenetics</h4>
                  <p className="text-sm text-gray-600">+45% growth</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h4 className="font-medium">Longevity</h4>
                  <p className="text-sm text-gray-600">+32% growth</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Brain className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h4 className="font-medium">Cognitive Health</h4>
                  <p className="text-sm text-gray-600">+28% growth</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Browse All Papers
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Join Research Study
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              View Trends
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Submit Research
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 