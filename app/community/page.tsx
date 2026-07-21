import { AppShell } from "@/components/app-shell"
import { CommunityFeed } from "@/components/community-feed"

export default function CommunityPage() {
  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-2">Community</h1>
        <p className="text-muted-foreground mb-6">
          Discuss longevity research, share protocols, and connect with other members.
          All posts are associated with your authenticated identity and subject to moderation.
        </p>
        <CommunityFeed />
      </main>
    </div>
    </AppShell>
  )
}
