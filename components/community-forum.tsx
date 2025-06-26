"use client"

import {
  Users,
  MessageSquare,
  ThumbsUp,
  Reply,
  Flag,
  Pin,
  Lock,
  Shield,
  Clock,
  Plus,
  Search,
  Eye,
  BookOpen,
  Lightbulb,
  AlertTriangle,
} from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const forumCategories = [
  {
    id: "beginners",
    name: "Beginners",
    description: "New to longevity? Start here!",
    posts: 234,
    color: "bg-green-600/20 text-green-300",
  },
  {
    id: "research",
    name: "Research Discussion",
    description: "Latest studies and findings",
    posts: 156,
    color: "bg-blue-600/20 text-blue-300",
  },
  {
    id: "compounds",
    name: "Compound Experiences",
    description: "Share your experiences",
    posts: 189,
    color: "bg-purple-600/20 text-purple-300",
  },
  {
    id: "safety",
    name: "Safety & Side Effects",
    description: "Important safety discussions",
    posts: 67,
    color: "bg-red-600/20 text-red-300",
  },
  {
    id: "success",
    name: "Success Stories",
    description: "Celebrate your wins!",
    posts: 89,
    color: "bg-yellow-600/20 text-yellow-300",
  },
  {
    id: "general",
    name: "General Discussion",
    description: "Everything else longevity",
    posts: 145,
    color: "bg-gray-600/20 text-gray-300",
  },
]

const forumPosts = [
  {
    id: 1,
    title: "New to NMN - What should I know?",
    author: {
      name: "Sarah Chen",
      avatar: "/placeholder.svg?height=40&width=40",
      level: "Beginner",
      joinDate: "2024-01-15",
      posts: 12,
      reputation: 45,
    },
    category: "beginners",
    content:
      "Hi everyone! I'm 35 and just starting my longevity journey. I've been reading about NMN and it sounds promising, but I'm overwhelmed by all the information. Can someone explain in simple terms what I should know before starting? Any beginner-friendly dosing recommendations?",
    timestamp: "2 hours ago",
    replies: 8,
    likes: 15,
    views: 124,
    isPinned: false,
    isLocked: false,
    tags: ["NMN", "beginner", "dosing"],
    lastReply: {
      author: "Dr. Martinez",
      timestamp: "30 minutes ago",
    },
  },
  {
    id: 2,
    title: "📌 IMPORTANT: Safety Guidelines for New Members",
    author: {
      name: "Dr. Martinez",
      avatar: "/placeholder.svg?height=40&width=40",
      level: "Expert",
      joinDate: "2023-06-01",
      posts: 234,
      reputation: 892,
      isModerator: true,
    },
    category: "safety",
    content:
      "Welcome to our community! Before you start experimenting with any compounds, please read these essential safety guidelines. Remember: this is NOT medical advice, and you should always consult with healthcare professionals...",
    timestamp: "1 day ago",
    replies: 23,
    likes: 67,
    views: 456,
    isPinned: true,
    isLocked: false,
    tags: ["safety", "guidelines", "important"],
    lastReply: {
      author: "ModeratorBot",
      timestamp: "4 hours ago",
    },
  },
  {
    id: 3,
    title: "My 6-month Resveratrol + Quercetin results",
    author: {
      name: "Mike Johnson",
      avatar: "/placeholder.svg?height=40&width=40",
      level: "Intermediate",
      joinDate: "2023-08-20",
      posts: 67,
      reputation: 234,
    },
    category: "success",
    content:
      "I wanted to share my experience after 6 months on a Resveratrol + Quercetin stack. Here are my before/after biomarkers and what I learned along the way. TL;DR: Significant improvements in inflammation markers!",
    timestamp: "3 hours ago",
    replies: 12,
    likes: 28,
    views: 189,
    isPinned: false,
    isLocked: false,
    tags: ["resveratrol", "quercetin", "results", "biomarkers"],
    lastReply: {
      author: "HealthOptimizer",
      timestamp: "1 hour ago",
    },
  },
  {
    id: 4,
    title: "New study on Spermidine and cardiovascular health",
    author: {
      name: "ResearchReader",
      avatar: "/placeholder.svg?height=40&width=40",
      level: "Advanced",
      joinDate: "2023-03-10",
      posts: 156,
      reputation: 567,
    },
    category: "research",
    content:
      "Just came across this fascinating new study published in Nature Medicine about spermidine's effects on cardiovascular health. The results are quite promising! Here's my summary of the key findings...",
    timestamp: "5 hours ago",
    replies: 19,
    likes: 34,
    views: 267,
    isPinned: false,
    isLocked: false,
    tags: ["spermidine", "cardiovascular", "study", "research"],
    lastReply: {
      author: "BiohackerPro",
      timestamp: "2 hours ago",
    },
  },
  {
    id: 5,
    title: "Experiencing nausea with NMN - normal?",
    author: {
      name: "ConcernedUser",
      avatar: "/placeholder.svg?height=40&width=40",
      level: "Beginner",
      joinDate: "2024-02-01",
      posts: 3,
      reputation: 8,
    },
    category: "safety",
    content:
      "I started taking NMN 250mg daily about a week ago and I've been experiencing mild nausea, especially in the morning. Is this normal? Should I reduce the dose or stop taking it? I'm a bit worried...",
    timestamp: "6 hours ago",
    replies: 15,
    likes: 7,
    views: 98,
    isPinned: false,
    isLocked: false,
    tags: ["NMN", "side-effects", "nausea", "help"],
    lastReply: {
      author: "Dr. Martinez",
      timestamp: "3 hours ago",
    },
  },
]

export function CommunityForum() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("recent")
  const [showNewPostForm, setShowNewPostForm] = useState(false)
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general", tags: "" })

  const filteredPosts = forumPosts
    .filter((post) => {
      const matchesCategory = selectedCategory === "all" || post.category === selectedCategory
      const matchesSearch =
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        case "popular":
          return b.likes - a.likes
        case "replies":
          return b.replies - a.replies
        case "views":
          return b.views - a.views
        default:
          return 0
      }
    })

  const handleNewPost = () => {
    // Simulate posting
    console.log("New post:", newPost)
    setShowNewPostForm(false)
    setNewPost({ title: "", content: "", category: "general", tags: "" })
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Intermediate":
        return "bg-blue-600/20 text-blue-300 border-blue-500/20"
      case "Advanced":
        return "bg-purple-600/20 text-purple-300 border-purple-500/20"
      case "Expert":
        return "bg-orange-600/20 text-orange-300 border-orange-500/20"
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Community Forum</h1>
        <p className="text-gray-400 text-lg mb-4">
          Connect with 50,000+ longevity enthusiasts, share experiences, and learn from experts
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <Users className="h-3 w-3 mr-1" />
            Moderated
          </Badge>
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Safe Space
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <BookOpen className="h-3 w-3 mr-1" />
            Educational
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Categories Sidebar */}
        <div>
          <Card className="bg-gray-800 border-gray-700 sticky top-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "ghost"}
                  className={`w-full justify-start ${selectedCategory === "all" ? "bg-teal-600 hover:bg-teal-700" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
                  onClick={() => setSelectedCategory("all")}
                >
                  All Categories
                </Button>
                {forumCategories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "ghost"}
                    className={`w-full justify-start ${selectedCategory === category.id ? "bg-teal-600 hover:bg-teal-700" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{category.name}</span>
                      <Badge className={category.color} variant="outline">
                        {category.posts}
                      </Badge>
                    </div>
                  </Button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <h4 className="text-white font-medium mb-3">Community Guidelines</h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Be respectful and supportive</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>No medical advice - share experiences only</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Cite sources when sharing research</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Flag className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>Report inappropriate content</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Forum Content */}
        <div className="lg:col-span-3">
          {/* Search and Controls */}
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search discussions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="recent">Most Recent</option>
                  <option value="popular">Most Popular</option>
                  <option value="replies">Most Replies</option>
                  <option value="views">Most Views</option>
                </select>

                <Button onClick={() => setShowNewPostForm(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* New Post Form */}
          {showNewPostForm && (
            <Card className="bg-gray-800 border-gray-700 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Create New Post</CardTitle>
                <CardDescription>Share your thoughts, questions, or experiences with the community</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Title</label>
                    <Input
                      placeholder="What's your post about?"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Category</label>
                    <select
                      value={newPost.category}
                      onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                      className="w-full bg-gray-700 border-gray-600 text-white rounded px-3 py-2"
                    >
                      {forumCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Content</label>
                    <Textarea
                      placeholder="Share your thoughts, experiences, or questions..."
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white min-h-[120px]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Tags (optional)</label>
                    <Input
                      placeholder="e.g., NMN, beginner, safety (comma-separated)"
                      value={newPost.tags}
                      onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <Alert className="border-blue-500/20 bg-blue-500/10">
                    <Lightbulb className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-blue-200 text-sm">
                      Remember: Share experiences, not medical advice. Always encourage consulting healthcare
                      professionals.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-3">
                    <Button onClick={handleNewPost} className="bg-teal-600 hover:bg-teal-700">
                      Post to Community
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowNewPostForm(false)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forum Posts */}
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={post.author.avatar || "/placeholder.svg"} alt={post.author.name} />
                      <AvatarFallback className="bg-gray-700 text-white">
                        {post.author.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {post.isPinned && <Pin className="h-4 w-4 text-teal-400" />}
                            {post.isLocked && <Lock className="h-4 w-4 text-gray-400" />}
                            <h3 className="text-white font-semibold text-lg hover:text-teal-400 cursor-pointer">
                              {post.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{post.author.name}</span>
                              {post.author.isModerator && (
                                <Badge className="bg-red-600/20 text-red-300 border-red-500/20 text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Moderator
                                </Badge>
                              )}
                              <Badge className={getLevelColor(post.author.level)} variant="outline">
                                {post.author.level}
                              </Badge>
                            </div>
                            <span>•</span>
                            <span>{post.timestamp}</span>
                            <span>•</span>
                            <span className="text-teal-400">
                              {forumCategories.find((c) => c.id === post.category)?.name}
                            </span>
                          </div>

                          <p className="text-gray-300 text-sm leading-relaxed mb-3 line-clamp-3">{post.content}</p>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {post.tags.map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                            <Flag className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4" />
                            <span>{post.likes}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            <span>{post.replies} replies</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span>{post.views} views</span>
                          </div>
                          {post.lastReply && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                Last reply by {post.lastReply.author} {post.lastReply.timestamp}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-green-400">
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Like
                          </Button>
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-blue-400">
                            <Reply className="h-4 w-4 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-8">
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              Load More Posts
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
