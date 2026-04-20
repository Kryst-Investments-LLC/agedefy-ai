import { Navigation } from "@/components/navigation"
import { CompoundMixer } from "@/components/compound-mixer"

export default async function MixerPage({
  searchParams,
}: {
  searchParams: Promise<{ compounds?: string }>
}) {
  const params = await searchParams
  const initialCompounds = params.compounds
    ? params.compounds.split(",").map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Compound Mixer</h1>
        <p className="text-muted-foreground mb-6">
          Explore longevity compounds, check interactions, and understand pathway coverage.
          Data sourced from published research.
        </p>
        <CompoundMixer initialCompounds={initialCompounds} />
      </main>
    </div>
  )
}
