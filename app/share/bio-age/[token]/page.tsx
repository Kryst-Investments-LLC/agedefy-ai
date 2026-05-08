import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { db } from "@/lib/db"
import { verifyShareToken } from "@/lib/sharing/share-token"

/* ------------------------------------------------------------------ */
/*  Metadata (dynamic OG image)                                       */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const payload = verifyShareToken(token)
  if (!payload) {
    return { title: "Share link expired — Biozephyra AI" }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://biozephyra.com"
  const ogUrl = new URL("/api/og", baseUrl)
  ogUrl.searchParams.set("template", "bio-age")

  return {
    title: "Bio-Age Score — Biozephyra AI",
    description: "See this user's biological age score on Biozephyra AI.",
    openGraph: {
      title: "Bio-Age Score — Biozephyra AI",
      description: "See this user's biological age score on Biozephyra AI.",
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Bio-Age Score — Biozephyra AI",
      images: [ogUrl.toString()],
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function SharedBioAgePage({ params }: PageProps) {
  const { token } = await params
  const payload = verifyShareToken(token)
  if (!payload || payload.shareType !== "bio-age") {
    notFound()
  }

  // Fetch latest bio-age snapshot (anonymised — no PII)
  const snapshot = await db.biologicalAgeSnapshot.findFirst({
    where: { userId: payload.userId },
    orderBy: { createdAt: "desc" },
    select: {
      biologicalAge: true,
      chronologicalAge: true,
      hallmarkScores: true,
      confidence: true,
      createdAt: true,
    },
  })

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">No Bio-Age Data</h1>
          <p className="text-muted-foreground">
            This user has not recorded a biological age score yet.
          </p>
        </div>
      </main>
    )
  }

  const diff = snapshot.chronologicalAge - snapshot.biologicalAge
  const diffColor = diff >= 0 ? "text-green-500" : "text-red-500"
  const diffLabel =
    diff >= 0
      ? `${diff.toFixed(1)} years younger`
      : `${Math.abs(diff).toFixed(1)} years older`

  let hallmarks: Record<string, number> = {}
  try {
    hallmarks = JSON.parse(snapshot.hallmarkScores) as Record<string, number>
  } catch {
    // invalid JSON — leave empty
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="mx-auto max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Biozephyra AI — Shared Bio-Age Score</p>
          <h1 className="text-6xl font-bold">{snapshot.biologicalAge.toFixed(1)}</h1>
          <p className="text-muted-foreground mt-1">
            Biological Age (Chronological: {snapshot.chronologicalAge.toFixed(1)})
          </p>
          <p className={`text-xl font-semibold mt-2 ${diffColor}`}>{diffLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confidence: {(snapshot.confidence * 100).toFixed(0)}% · Computed{" "}
            {new Date(snapshot.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Hallmark breakdown */}
        {Object.keys(hallmarks).length > 0 && (
          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3">Hallmark Scores</h2>
            <div className="space-y-2">
              {Object.entries(hallmarks).map(([hallmark, score]) => (
                <div key={hallmark} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{hallmark.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2 w-1/2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(score * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Your Bio-Age Score
          </Link>
        </div>
      </div>
    </main>
  )
}
