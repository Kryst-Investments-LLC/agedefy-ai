"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Flag, Eye, EyeOff, Trash2, RefreshCw } from "lucide-react"

interface ModerationPost {
  id: string
  title: string
  body: string
  category: string
  flagged: boolean
  published: boolean
  createdAt: string
  author: { id: string; email: string; name: string | null; role: string }
}

export function AdminCommunityModeration() {
  const [posts, setPosts] = useState<ModerationPost[]>([])
  const [total, setTotal] = useState(0)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/admin/community?limit=50${flaggedOnly ? "&flagged=true" : ""}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [flaggedOnly])

  useEffect(() => { load() }, [load])

  const act = async (postId: string, action: string) => {
    setActing(postId)
    try {
      const res = await fetch("/api/admin/community", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      })
      if (res.ok) {
        if (action === "delete") {
          setPosts((prev) => prev.filter((p) => p.id !== postId))
          setTotal((t) => t - 1)
        } else {
          // Re-fetch for updated state
          await load()
        }
      }
    } finally {
      setActing(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Community Moderation ({total})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant={flaggedOnly ? "default" : "outline"} size="sm" onClick={() => setFlaggedOnly(!flaggedOnly)}>
              <Flag className="h-4 w-4 mr-1" /> {flaggedOnly ? "Flagged only" : "All posts"}
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {posts.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No community posts to review.</p>
        )}
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className={`rounded-lg border p-4 space-y-2 ${post.flagged ? "border-red-700 bg-red-950/20" : ""} ${!post.published ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{post.title}</span>
                    <Badge variant="outline" className="text-xs">{post.category}</Badge>
                    {post.flagged && <Badge variant="destructive" className="text-xs">Flagged</Badge>}
                    {!post.published && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    by {post.author.name ?? post.author.email} ({post.author.role}) — {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {post.flagged ? (
                    <Button variant="ghost" size="sm" onClick={() => act(post.id, "unflag")} disabled={acting === post.id} title="Unflag">
                      <Flag className="h-4 w-4 text-green-500" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => act(post.id, "flag")} disabled={acting === post.id} title="Flag">
                      <Flag className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                  {post.published ? (
                    <Button variant="ghost" size="sm" onClick={() => act(post.id, "unpublish")} disabled={acting === post.id} title="Hide">
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => act(post.id, "publish")} disabled={acting === post.id} title="Publish">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => act(post.id, "delete")} disabled={acting === post.id} title="Delete">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
