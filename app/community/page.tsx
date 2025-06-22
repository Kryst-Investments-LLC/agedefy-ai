import { CommunityForum } from "@/components/community-forum"
import { Navigation } from "@/components/navigation"

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <CommunityForum />
    </div>
  )
}
