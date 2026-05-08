"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { LocaleProvider } from "@/lib/i18n/context"
import { PwaInstallBanner } from "@/components/pwa-install-banner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <LocaleProvider>
          {children}
          <Toaster />
          <PwaInstallBanner />
        </LocaleProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}