import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { NotificationSettings } from '@/components/notification-settings'
import { authOptions } from '@/lib/auth'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  return (
    <AppShell pageTitle="Settings">
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your notification preferences and account settings.
        </p>

        <div className="mt-8">
          <NotificationSettings />
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Developer</h2>
          <Link
            href="/settings/api-keys"
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted transition-colors"
          >
            <div>
              <p className="font-medium">API Keys</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create and manage keys for programmatic access to the research APIs.
              </p>
            </div>
            <span className="text-muted-foreground ml-4">→</span>
          </Link>
        </div>
      </main>
    </AppShell>
  )
}
