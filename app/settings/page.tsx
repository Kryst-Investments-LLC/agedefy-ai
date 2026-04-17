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
      </main>
    </AppShell>
  )
}
