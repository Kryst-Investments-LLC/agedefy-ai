import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import type { Metadata } from 'next'

import { Navigation } from '@/components/navigation'
import { ExperimentBoard } from '@/components/experiment/experiment-board'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Experiment Pipeline | Biozephyra ÆonForge',
  description:
    'Track compound candidates through the full lifecycle: Proposed → Screened → Sent to Lab → Result Logged → Fed Back.',
}

export default async function ExperimentPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/sign-in')
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-[1400px] px-4 py-8">
        <ExperimentBoard />
      </main>
    </>
  )
}
