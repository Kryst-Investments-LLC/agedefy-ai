import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import type { Metadata } from 'next'

import { Navigation } from '@/components/navigation'
import { ResearcherWorkbench } from '@/components/researcher/researcher-workbench'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Researcher Workbench | Biozephyra ÆonForge',
  description:
    'Search the ChEMBL compound library by target, review cross-check status, screening scores, and send candidates to validation.',
}

export default async function ResearcherPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/sign-in')
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <ResearcherWorkbench />
      </main>
    </>
  )
}
