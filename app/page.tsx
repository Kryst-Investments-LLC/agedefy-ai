import { EnhancedHero } from "@/components/enhanced-hero"
import { Features } from "@/components/features"
import { Testimonials } from "@/components/testimonials"
import { Stats } from "@/components/stats"
import { Newsletter } from "@/components/newsletter"
import { Footer } from "@/components/footer"
import { CookieConsent } from "@/components/cookie-consent"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <EnhancedHero />
      <Stats />
      <Features />
      <Testimonials />
      <Newsletter />
      <Footer />
      <CookieConsent />
    </div>
  )
}
