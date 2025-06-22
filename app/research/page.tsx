import { ResearchSearch } from "@/components/research-search"
import { Navigation } from "@/components/navigation"

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <ResearchSearch />
    </div>
  )
}
