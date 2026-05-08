import { Navigation } from "@/components/navigation"
import { CompoundMixer } from "@/components/compound-mixer"

export default function MixerPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">Compound Mixer</h1>
        <p className="text-muted-foreground mb-6">
          Explore longevity compounds, check interactions, and understand pathway coverage.
          Data sourced from published research.
        </p>
        <CompoundMixer />
      </main>
    </div>
  )
}
