import type { Metadata } from "next"
import { Inter } from "next/font/google"
import type React from "react"

import { LocaleProvider } from "@/lib/i18n/context"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AgeDefy AI - Advanced Anti-Aging Research Platform",
  description:
    "The world's most comprehensive anti-aging research platform. Discover safe compound combinations, understand complex research, and make informed longevity decisions with AI-powered insights.",
  keywords: "anti-aging, longevity, compounds, AI, research, safety, health, supplements, biomarkers",
  authors: [{ name: "AgeDefy AI Team - Kryst Investments LLC" }],
  openGraph: {
    title: "AgeDefy AI - Advanced Anti-Aging Research Platform",
    description: "Discover safe anti-aging solutions with AI-powered insights and comprehensive safety monitoring.",
    type: "website",
    url: "https://agedefy.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgeDefy AI - Advanced Anti-Aging Research Platform",
    description: "Discover safe anti-aging solutions with AI-powered insights and comprehensive safety monitoring.",
  },
  robots: {
    index: true,
    follow: true,
  },
  generator: 'v0.dev',
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0d9488" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AgeDefy AI" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <LocaleProvider>
          {children}
        </LocaleProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
