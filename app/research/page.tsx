import { Navigation } from "@/components/navigation"
import { ResearchSearch } from "@/components/research-search"

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <ResearchSearch />
    </div>
  )
}
