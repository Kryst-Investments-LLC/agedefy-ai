import { notFound } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MolecularViewer } from "@/components/discovery/molecular-viewer"
import { db } from "@/lib/db"
import { ArrowLeft, ExternalLink } from "lucide-react"

const severityColor: Record<string, string> = {
  BENEFICIAL: "bg-green-600 text-white",
  NEUTRAL: "bg-gray-600 text-foreground",
  CAUTION: "bg-yellow-600 text-foreground",
  DANGEROUS: "bg-red-600 text-white",
  UNKNOWN: "bg-gray-500 text-foreground",
}

export default async function CompoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const compound = await db.compound.findUnique({
    where: { id },
    include: {
      pathways: { include: { pathway: true } },
      interactions: { include: { compoundB: { select: { id: true, name: true, category: true } } } },
      interactedWith: { include: { compoundA: { select: { id: true, name: true, category: true } } } },
      biomarkerEffects: true,
      studyLinks: true,
    },
  })

  if (!compound) notFound()

  const aliases = compound.aliases ? (JSON.parse(compound.aliases) as string[]) : []
  const allInteractions = [
    ...compound.interactions.map((ix) => ({
      other: ix.compoundB,
      severity: ix.severity,
      description: ix.description,
    })),
    ...compound.interactedWith.map((ix) => ({
      other: ix.compoundA,
      severity: ix.severity,
      description: ix.description,
    })),
  ]

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-4xl px-4 py-10 text-foreground">
        <Link href="/mixer">
          <Button variant="ghost" className="text-muted-foreground hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Mixer
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl font-bold">{compound.name}</h1>
            <Badge variant="outline" className="text-sm">{compound.category}</Badge>
          </div>
          {aliases.length > 0 && (
            <p className="mt-2 text-muted-foreground">Also known as: {aliases.join(", ")}</p>
          )}
          {compound.casNumber && (
            <p className="mt-1 text-xs text-muted-foreground">CAS: {compound.casNumber}</p>
          )}
        </div>

        {/* 3D Molecular Structure */}
        {(compound.pubChemCid || compound.name) && (
          <div className="mb-6">
            <MolecularViewer
              pubChemCid={compound.pubChemCid ?? undefined}
              compoundName={compound.name}
              name={compound.name}
              height={320}
            />
          </div>
        )}

        {/* Mechanism */}
        {compound.mechanism && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Mechanism of Action</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{compound.mechanism}</p>
            </CardContent>
          </Card>
        )}

        {/* Pathways */}
        {compound.pathways.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Pathway Targets ({compound.pathways.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {compound.pathways.map((cp) => (
                  <div key={cp.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <span className="font-medium">{cp.pathway.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{cp.pathway.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {cp.effect === "inhibitor" ? "↓ Inhibitor" : cp.effect === "activator" ? "↑ Activator" : "~ Modulator"}
                      </Badge>
                      {cp.strength && <Badge variant="outline" className="text-xs">{cp.strength}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Biomarker Effects */}
        {compound.biomarkerEffects.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Biomarker Effects ({compound.biomarkerEffects.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {compound.biomarkerEffects.map((be) => (
                  <div key={be.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{be.biomarkerName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {be.direction === "decrease" ? "↓" : be.direction === "increase" ? "↑" : "—"} {be.direction}
                      </Badge>
                      {be.magnitude && <Badge variant="outline" className="text-xs">{be.magnitude}</Badge>}
                    </div>
                    {be.source && <p className="text-xs text-muted-foreground mt-1">Source: {be.source}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interactions */}
        {allInteractions.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Known Interactions ({allInteractions.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allInteractions.map((ix, i) => (
                  <div key={i} className="rounded-lg border p-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/compounds/${ix.other.id}`} className="font-medium hover:underline">
                          {ix.other.name}
                        </Link>
                        <Badge className={`text-xs ${severityColor[ix.severity]}`}>{ix.severity}</Badge>
                      </div>
                      {ix.description && <p className="text-sm text-muted-foreground mt-1">{ix.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Study Links */}
        {compound.studyLinks.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Referenced Studies ({compound.studyLinks.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {compound.studyLinks.map((sl) => (
                  <div key={sl.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">{sl.source}</Badge>
                    {sl.url ? (
                      <a href={sl.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                        {sl.title ?? sl.externalId} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>{sl.title ?? sl.externalId}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Information sourced from published research. Always consult a healthcare provider before using any compound.
        </p>
      </main>
    </div>
    </AppShell>
  )
}
