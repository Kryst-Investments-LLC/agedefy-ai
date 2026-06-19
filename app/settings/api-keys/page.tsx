import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { ApiKeyManager } from '@/components/settings/api-key-manager'
import { authOptions } from '@/lib/auth'
import { listAPIKeys } from '@/lib/api-keys/manager'

export default async function ApiKeysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  const rawKeys = await listAPIKeys(session.user.id)

  // Date objects are not serializable across the RSC boundary — convert to ISO strings
  const keys = rawKeys.map((k) => ({
    ...k,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }))

  return (
    <AppShell pageTitle="API Keys">
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys for programmatic access to Biozephyra research APIs.
            Keys are shown once on creation — store them securely.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            See the{' '}
            <a href="/developers" className="underline underline-offset-2">
              Developer Portal
            </a>{' '}
            for endpoint documentation and available scopes.
          </p>
        </div>

        <ApiKeyManager initialKeys={keys} />
      </main>
    </AppShell>
  )
}
