import { Navigation } from "@/components/navigation"
import { CommunityFeed } from "@/components/community-feed"

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-white mb-2">Community</h1>
        <p className="text-muted-foreground mb-6">
          Discuss longevity research, share protocols, and connect with other members.
          All posts are associated with your authenticated identity and subject to moderation.
        </p>
        <CommunityFeed />
      </main>
    </div>
  )
}
