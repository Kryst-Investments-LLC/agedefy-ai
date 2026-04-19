import { Features } from "@/components/features"
import { Stats } from "@/components/stats"
import { Footer } from "@/components/footer"
import { CookieConsent } from "@/components/cookie-consent"
import { Navigation } from "@/components/navigation"
import { LandingHero } from "@/components/landing-hero"
import { db } from "@/lib/db"

export default async function HomePage() {
  const [userCount, biomarkerCount, compoundCount] = await Promise.all([
    db.user.count(),
    db.biomarker.count(),
    db.compound.count(),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <LandingHero
        userCount={userCount}
        biomarkerCount={biomarkerCount}
        compoundCount={compoundCount}
      />

      <Stats />
      <Features />
      <Footer />
      <CookieConsent />
    </div>
  )
}
