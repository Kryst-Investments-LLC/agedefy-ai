'use client'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

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
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
