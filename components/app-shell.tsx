'use client'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AiServiceBanner } from '@/components/ai-service-banner'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/notification-bell'
// Language switcher hidden for launch — the platform ships English-only for now.

type AppShellProps = {
  children: React.ReactNode
  pageTitle?: string
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {pageTitle && (
            <span className="text-sm font-medium">{pageTitle}</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Honest AI-outage banner (INT-008) — renders only when degraded */}
        <AiServiceBanner />

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
