"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { LocaleProvider } from "@/lib/i18n/context"
import { PwaInstallBanner } from "@/components/pwa-install-banner"

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <SessionProvider>
      {/* nonce lets next-themes' pre-hydration theme script satisfy the strict
          CSP (script-src 'nonce-…' 'strict-dynamic'); without it the script is
          blocked and every load falls back to the light :root theme. */}
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>
        <LocaleProvider>
          {children}
          <Toaster />
          <PwaInstallBanner />
        </LocaleProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}