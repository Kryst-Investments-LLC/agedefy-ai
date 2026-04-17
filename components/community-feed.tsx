"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, Send } from "lucide-react"
import { useSession } from "next-auth/react"

interface Post {
  id: string
  title: string
  body: string
  category: string
  createdAt: string
  author: { id: string; name: string | null; role: string; createdAt: string }
}

const CATEGORIES = ["COMPOUNDS", "BIOMARKERS", "PROTOCOLS", "RESEARCH", "GENERAL"] as const

export function CommunityFeed() {
  const { data: session } = useSession()
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [category, setCategory] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  // New post form
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [postCategory, setPostCategory] = useState<string>("GENERAL")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async (cat: string, cursor?: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (cat !== "all") params.set("category", cat)
    if (cursor) params.set("cursor", cursor)
    params.set("limit", "15")
    const res = await fetch(`/api/community?${params}`)
    if (res.ok) {
      const data = await res.json()
      setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts))
      setNextCursor(data.nextCursor)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setPosts([])
    load(category)
  }, [category, load])

  const submit = async () => {
    setError("")
    setSubmitting(true)
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, category: postCategory }),
    })
    if (res.ok) {
      setTitle("")
      setBody("")
      setPosts([])
      load(category)
    } else {
      const data = await res.json()
      setError(data.error ?? "Failed to create post")
    }
    setSubmitting(false)
  }

  const categoryColor: Record<string, string> = {
    COMPOUNDS: "bg-purple-600",
    BIOMARKERS: "bg-blue-600",
    PROTOCOLS: "bg-green-600",
    RESEARCH: "bg-amber-600",
    GENERAL: "bg-gray-600",
  }

  return (
    <div className="space-y-6">
      {/* Post form (authenticated only) */}
      {session?.user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> New Discussion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Discussion title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Share your thoughts, questions, or findings…"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Select value={postCategory} onValueChange={setPostCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={submit} disabled={submitting || title.length < 5 || body.length < 20}>
                <Send className="h-4 w-4 mr-2" /> Post
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={category === "all" ? "default" : "outline"} size="sm" onClick={() => setCategory("all")}>All</Button>
        {CATEGORIES.map((c) => (
          <Button key={c} variant={category === c ? "default" : "outline"} size="sm" onClick={() => setCategory(c)}>
            {c.charAt(0) + c.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {/* Posts */}
      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`${categoryColor[post.category] ?? "bg-gray-600"} text-white text-xs`}>
                {post.category}
              </Badge>
              <h3 className="font-semibold flex-1">{post.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.body}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <span>{post.author.name ?? "Anonymous"}</span>
              <Badge variant="outline" className="text-xs">{post.author.role}</Badge>
              <span>·</span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}

      {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

      {!loading && posts.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No discussions yet. {session?.user ? "Start one above!" : "Sign in to start a discussion."}
          </CardContent>
        </Card>
      )}

      {nextCursor && !loading && (
        <div className="text-center">
          <Button variant="outline" onClick={() => load(category, nextCursor ?? undefined)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
