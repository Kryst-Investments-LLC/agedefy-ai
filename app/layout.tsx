import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { headers } from "next/headers"

import { Providers } from "./providers"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Biozephyra - Longevity Research And Care Workflows",
  description:
    "A platform for tracking biomarkers, organizing protocols, reviewing longevity research, and coordinating related marketplace and telemedicine workflows.",
  keywords: "longevity, biomarkers, protocols, AI, research, telemedicine, marketplace, health workflows",
  authors: [{ name: "Biozephyra Team" }],
  openGraph: {
    title: "Biozephyra - Longevity Research And Care Workflows",
    description: "Track biomarkers, review longevity research, and coordinate related care and marketplace workflows.",
    type: "website",
    url: "https://biozephyra.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Biozephyra - Longevity Research And Care Workflows",
    description: "Track biomarkers, review longevity research, and coordinate related care and marketplace workflows.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Touch headers() so this layout stays dynamic and the proxy.ts CSP/nonce
  // headers are generated per request even though we no longer inject an
  // inline <script nonce>.
  await headers()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
