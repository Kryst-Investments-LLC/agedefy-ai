import { CookieConsent } from "@/components/cookie-consent"
import { EnhancedHero } from "@/components/enhanced-hero"
import { Features } from "@/components/features"
import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"
import { Newsletter } from "@/components/newsletter"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { Stats } from "@/components/stats"
import { Testimonials } from "@/components/testimonials"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <EnhancedHero />
      <Stats />
      <Features />
      <Testimonials />
      <Newsletter />
      <Footer />
      <CookieConsent />
      <PWAInstallPrompt />
    </div>
  )
}
