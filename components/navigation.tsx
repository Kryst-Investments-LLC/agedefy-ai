"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlobalSearch } from "@/components/global-search"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTranslation } from "@/lib/i18n/useTranslation"
import {
  Menu,
  X,
  Home,
  TestTube,
  Search,
  BarChart3,
  Users,
  BookOpen,
  Shield,
  Stethoscope,
  ShoppingCart,
  Microscope,
  Calendar,
  DollarSign,
  User,
  Brain,
  GitBranch,
  Sparkles,
  Handshake,
} from "lucide-react"

const BADGE_CLS = "ml-auto bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-600/20 dark:text-teal-300 dark:border-teal-500/20 text-xs"

type NavItem = {
  /** Fallback label when the translation key is missing */
  fallback: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navigation: NavItem[] = [
  { i18nKey: "home", fallback: "Home", href: "/", icon: Home },
  { i18nKey: "dashboard", fallback: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { i18nKey: "research", fallback: "Research", href: "/research", icon: Search },
  { i18nKey: "predictiveAnalytics", fallback: "Intelligence", href: "/intelligence", icon: Sparkles, badge: "New" },
  { i18nKey: "compoundMixer", fallback: "Compound Mixer", href: "/mixer", icon: TestTube },
  { i18nKey: "pathways", fallback: "Pathways", href: "/pathways", icon: GitBranch },
  { i18nKey: "community", fallback: "Community", href: "/community", icon: Users },
  { i18nKey: "learn", fallback: "Learn", href: "/learn", icon: BookOpen },
  { i18nKey: "telemedicine", fallback: "Telemedicine", href: "/telemedicine", icon: Stethoscope },
  { i18nKey: "marketplace", fallback: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { i18nKey: "scientistSponsor", fallback: "Scientist-Sponsor", href: "/scientist-sponsor", icon: Handshake, badge: "Beta" },
  { i18nKey: "labTesting", fallback: "Lab Testing", href: "/lab-testing", icon: Microscope, badge: "Premium" },
  { i18nKey: "clinicalTrials", fallback: "Clinical Trials", href: "/clinical-trials", icon: Calendar, badge: "Premium" },
  { i18nKey: "aiPersonalization", fallback: "AI Personalization", href: "/personalization", icon: Brain, badge: "Premium" },
]

/**
 * Lateral sidebar navigation.
 *
 * - Fixed left sidebar on `lg+` screens (16rem wide).
 * - Collapsible drawer on small screens, triggered by the top bar's menu button.
 * - Labels are translated live via `useTranslation`. When a key is missing the
 *   component falls back to the English label (see each item's `fallback`).
 * - Top bar hosts the global search, language switcher, theme toggle, and
 *   account shortcuts.
 *
 * Page content is offset to the right of the sidebar via a global CSS rule in
 * `app/globals.css` (`@media (min-width: 1024px) { body { padding-left: 16rem } }`).
 */
export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useTranslation()

  function label(item: NavItem) {
    const translated = t(`navigation.${item.i18nKey}`)
    // `t()` returns the raw key string when the translation is missing.
    if (translated === `navigation.${item.i18nKey}`) return item.fallback
    return translated
  }

  function isActive(href: string) {
    if (!pathname) return false
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {/* Top bar (all screen sizes). On lg+ it sits to the right of the sidebar. */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-700 bg-gray-800/95 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-gray-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>

          {/* Logo (shown in top bar on small screens; sidebar has its own) */}
          <Link href="/" className="flex items-center space-x-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-teal-400 to-blue-400">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Biozephyra</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:block">
            <GlobalSearch />
          </div>
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/pricing" className="hidden md:inline-flex">
            <Button variant="ghost" className="text-gray-300 hover:text-white">
              <DollarSign className="mr-1 h-4 w-4" />
              {label({ i18nKey: "pricing", fallback: "Pricing", href: "/pricing", icon: DollarSign })}
            </Button>
          </Link>
          <Link href="/account" className="hidden md:inline-flex">
            <Button variant="ghost" className="text-gray-300 hover:text-white">
              <User className="mr-1 h-4 w-4" />
              {label({ i18nKey: "account", fallback: "Account", href: "/account", icon: User })}
            </Button>
          </Link>
        </div>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-gray-700 bg-gray-900/95 backdrop-blur-sm lg:flex">
        <Link href="/" className="flex h-16 items-center space-x-2 border-b border-gray-700 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-teal-400 to-blue-400">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Biozephyra</span>
          <Badge className={BADGE_CLS}>BETA</Badge>
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start gap-2 ${
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="truncate">{label(item)}</span>
                      {item.badge && (
                        <Badge className={BADGE_CLS}>
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t border-border p-3">
          <Button className="w-full bg-teal-600 text-white hover:bg-teal-700">
            {label({ i18nKey: "getStarted", fallback: "Get Started", href: "#", icon: User })}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-700 bg-gray-900/95 backdrop-blur-sm transition-transform duration-200 lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-700 px-4">
          <Link href="/" className="flex items-center space-x-2" onClick={() => setIsOpen(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-teal-400 to-blue-400">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Biozephyra</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-300 hover:text-white"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setIsOpen(false)}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start gap-2 ${
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="truncate">{label(item)}</span>
                      {item.badge && (
                        <Badge className={BADGE_CLS}>
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                </li>
              )
            })}
            <li>
              <Link href="/pricing" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <DollarSign className="h-4 w-4" />
                  {label({ i18nKey: "pricing", fallback: "Pricing", href: "/pricing", icon: DollarSign })}
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/account" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <User className="h-4 w-4" />
                  {label({ i18nKey: "account", fallback: "Account", href: "/account", icon: User })}
                </Button>
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  )
}
