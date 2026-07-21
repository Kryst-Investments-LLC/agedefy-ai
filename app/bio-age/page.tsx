import { AppShell } from "@/components/app-shell"
import { BioAgeScoreCard } from "@/components/bio-age-score-card"
import { BioAgeTimeline } from "@/components/bio-age-timeline"

export const metadata = {
  title: "Biological Age — Biozephyra",
  description: "Compute and track your biological age based on biomarker analysis.",
}

export default function BioAgePage() {
  return (
    <AppShell pageTitle="Bio-Age">
      <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biological Age</h1>
          <p className="mt-1 text-muted-foreground">
            Your composite biological age derived from biomarkers and the 9
            hallmarks of aging.
          </p>
        </div>

        <BioAgeScoreCard />
        <BioAgeTimeline />
      </div>
    </AppShell>
  )
}
