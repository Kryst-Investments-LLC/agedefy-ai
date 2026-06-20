import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'

import { AppShell } from "@/components/app-shell"
import { DiscoveryLab } from '@/components/discovery/discovery-lab'
import type { DiscoveryCandidateSummary } from '@/components/discovery/types'
import { gradeCandidate } from '@/lib/aeonforge/evidence-grade'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function getCandidateCount(value: Prisma.JsonValue): number {
  if (Array.isArray(value)) {
    return value.length
  }

  if (value && typeof value === 'object' && 'count' in value) {
    const count = value.count
    return typeof count === 'number' ? count : 0
  }

  return 0
}

export default async function DiscoveryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/sign-in')
  }

  // Fetch user's recent candidates and simulations
  const [candidates, userTier] = await Promise.all([
    db.aeonForgeCandidate.findMany({
      where: { userId: session.user.id },
      include: {
        simulationResults: {
          take: 3,
        },
        virtualTwinRuns: {
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { discoveryTier: true, role: true },
    }),
  ])

  const tier = userTier?.discoveryTier || 'explorer'
  const recentCandidates: DiscoveryCandidateSummary[] = candidates.map((candidate) => ({
    id: candidate.id,
    prompt: candidate.prompt,
    candidateCount: getCandidateCount(candidate.candidates),
    simulationScore: candidate.simulationScore,
    safetyScore: candidate.safetyScore,
    healthspanDelta: candidate.healthspanDelta,
    status: candidate.status,
    simulations: candidate.simulationResults.length,
    virtualTwins: candidate.virtualTwinRuns.length,
    createdAt: candidate.createdAt,
    evidenceGrade: gradeCandidate({
      simulationScore: candidate.simulationScore,
      safetyScore: candidate.safetyScore,
    }),
  }))

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="container mx-auto py-8">
        <DiscoveryLab
          tier={tier as 'explorer' | 'pro' | 'enterprise'}
          recentCandidates={recentCandidates}
        />
      </main>
    </div>
    </AppShell>
  )
}
