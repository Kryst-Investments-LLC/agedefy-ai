"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Heart, MessageSquare, Share, Star, Camera, Video, FileText } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function UserGeneratedContent() {
  const { t } = useTranslation()
  const [selectedPost, setSelectedPost] = useState("transformation-story")

  const communityPosts = [
    {
      id: "transformation-story",
      author: "Sarah M.",
      avatar: "SM",
      title: "My 6-Month Longevity Transformation",
      type: "Story",
      content: "After following the AI-recommended protocol, my biomarkers improved dramatically...",
      likes: 234,
      comments: 45,
      shares: 12,
      timestamp: "2 hours ago",
      tags: ["Transformation", "Biomarkers", "Success"]
    },
    {
      id: "supplement-review",
      author: "Dr. James K.",
      avatar: "JK",
      title: "NMN vs NAD+ Precursors: My Clinical Experience",
      type: "Review",
      content: "Having tested both with my patients, here's what I've observed...",
      likes: 189,
      comments: 67,
      shares: 28,
      timestamp: "5 hours ago",
      tags: ["NMN", "NAD+", "Clinical", "Expert"]
    },
    {
      id: "workout-routine",
      author: "Mike R.",
      avatar: "MR",
      title: "Zone 2 Cardio Protocol That Changed My Life",
      type: "Tutorial",
      content: "Step-by-step guide to implementing effective Zone 2 training...",
      likes: 156,
      comments: 32,
      shares: 19,
      timestamp: "1 day ago",
      tags: ["Exercise", "Zone2", "Cardio", "Tutorial"]
    },
    {
      id: "recipe-share",
      author: "Lisa T.",
      avatar: "LT",
      title: "Anti-Inflammatory Smoothie Recipe",
      type: "Recipe",
      content: "This turmeric-ginger smoothie has become my daily staple...",
      likes: 98,
      comments: 23,
      shares: 15,
      timestamp: "2 days ago",
      tags: ["Nutrition", "Recipe", "Anti-inflammatory"]
    }
  ]

  const contentCategories = [
    { name: "Success Stories", count: 156, icon: Star },
    { name: "Product Reviews", count: 89, icon: MessageSquare },
    { name: "Tutorials", count: 67, icon: Video },
    { name: "Recipes", count: 134, icon: FileText },
    { name: "Research Discussions", count: 45, icon: Users },
    { name: "Q&A", count: 203, icon: MessageSquare }
  ]

  const featuredCreators = [
    {
      name: "Dr. Sarah Chen",
      specialty: "Longevity Medicine",
      followers: 12500,
      posts: 89,
      verified: true,
      avatar: "SC"
    },
    {
      name: "Mark Johnson",
      specialty: "Biohacking",
      followers: 8900,
      posts: 156,
      verified: false,
      avatar: "MJ"
    },
    {
      name: "Prof. Elena Rodriguez",
      specialty: "Nutrition Science",
      followers: 15600,
      posts: 67,
      verified: true,
      avatar: "ER"
    },
    {
      name: "Alex Kim",
      specialty: "Fitness & Recovery",
      followers: 6700,
      posts: 234,
      verified: false,
      avatar: "AK"
    }
  ]

  const myContributions = [
    {
      title: "My Experience with Intermittent Fasting",
      type: "Story",
      status: "Published",
      views: 1234,
      likes: 89,
      date: "2024-12-18"
    },
    {
      title: "Supplement Stack Review: Month 3",
      type: "Review",
      status: "Draft",
      views: 0,
      likes: 0,
      date: "2024-12-20"
    },
    {
      title: "Cold Therapy Protocol Video",
      type: "Tutorial",
      status: "Under Review",
      views: 567,
      likes: 34,
      date: "2024-12-19"
    }
  ]

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Story": return <Star className="h-4 w-4 text-yellow-400" />
      case "Review": return <MessageSquare className="h-4 w-4 text-blue-400" />
      case "Tutorial": return <Video className="h-4 w-4 text-green-400" />
      case "Recipe": return <FileText className="h-4 w-4 text-purple-400" />
      default: return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Draft": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "Under Review": return "bg-blue-600/20 text-blue-300 border-blue-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">User-Generated Content</h2>
        <p className="text-gray-400">Share knowledge and learn from the longevity community</p>
      </div>

      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="feed" className="text-gray-300">Community Feed</TabsTrigger>
          <TabsTrigger value="categories" className="text-gray-300">Categories</TabsTrigger>
          <TabsTrigger value="creators" className="text-gray-300">Featured Creators</TabsTrigger>
          <TabsTrigger value="my-content" className="text-gray-300">My Content</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          <div className="space-y-4">
            {communityPosts.map((post) => (
              <Card 
                key={post.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedPost === post.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedPost(post.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                        {post.avatar}
                      </div>
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          {getTypeIcon(post.type)}
                          {post.title}
                        </CardTitle>
                        <p className="text-gray-400 text-sm">by {post.author} • {post.timestamp}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{post.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 mb-4">{post.content}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <Badge key={index} className="bg-blue-600/20 text-blue-300 border-blue-500/20 text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400">
                        <Heart className="h-4 w-4 mr-1" />
                        {post.likes}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {post.comments}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-green-400">
                        <Share className="h-4 w-4 mr-1" />
                        {post.shares}
                      </Button>
                    </div>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                      Read More
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contentCategories.map((category, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <category.icon className="h-5 w-5 text-blue-400" />
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400 mb-2">
                    {category.count}
                  </div>
                  <p className="text-gray-400 text-sm">Posts available</p>
                  <Button className="w-full mt-3 bg-teal-600 hover:bg-teal-700">
                    Browse Category
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="creators" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredCreators.map((creator, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                        {creator.avatar}
                      </div>
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          {creator.name}
                          {creator.verified && <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">Verified</Badge>}
                        </CardTitle>
                        <p className="text-gray-400 text-sm">{creator.specialty}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-400">{creator.followers.toLocaleString()}</div>
                      <p className="text-gray-400 text-xs">Followers</p>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-400">{creator.posts}</div>
                      <p className="text-gray-400 text-xs">Posts</p>
                    </div>
                  </div>
                  <Button className="w-full bg-teal-600 hover:bg-teal-700">
                    Follow Creator
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-content" className="space-y-4">
          <div className="mb-4">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Camera className="h-4 w-4 mr-2" />
              Create New Post
            </Button>
          </div>
          
          <div className="space-y-4">
            {myContributions.map((contribution, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {getTypeIcon(contribution.type)}
                      {contribution.title}
                    </CardTitle>
                    <Badge className={getStatusColor(contribution.status)}>
                      {contribution.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-gray-400">Views: </span>
                      <span className="text-white">{contribution.views.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Likes: </span>
                      <span className="text-white">{contribution.likes}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Date: </span>
                      <span className="text-white">{contribution.date}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      View Analytics
                    </Button>
                    {contribution.status === "Published" && (
                      <Button variant="outline" size="sm">
                        Share
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
