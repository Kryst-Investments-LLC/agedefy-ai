"use client"

import Link from "next/link"
import { useTranslation } from "@/lib/i18n/useTranslation"

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Biozephyra</h3>
            <p className="text-gray-400 text-sm">
              {t("footer.tagline", "Making anti-aging research accessible to everyone through AI-powered insights and education.")}
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">{t("footer.featuresTitle", "Features")}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link href="/mixer" className="hover:text-teal-400">
                  {t("footer.compoundMixer", "Compound Mixer")}
                </Link>
              </li>
              <li>
                <Link href="/research" className="hover:text-teal-400">
                  {t("footer.researchSearch", "Research Search")}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-teal-400">
                  {t("navigation.dashboard", "Dashboard")}
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-teal-400">
                  {t("navigation.community", "Community")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">{t("footer.supportTitle", "Support")}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link href="/help" className="hover:text-teal-400">
                  {t("footer.helpCenter", "Help Center")}
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-teal-400">
                  {t("footer.safetyGuidelines", "Safety Guidelines")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-teal-400">
                  {t("footer.contactUs", "Contact Us")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">{t("footer.legalTitle", "Legal")}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-teal-400">
                  {t("footer.privacyPolicy", "Privacy Policy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-teal-400">
                  {t("footer.termsOfService", "Terms of Service")}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-teal-400">
                  {t("footer.medicalDisclaimer", "Medical Disclaimer")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            {t("footer.copyright", "\u00a9 2026 Biozephyra. All rights reserved. This app is for educational purposes only and does not provide medical advice.")}
          </p>
        </div>
      </div>
    </footer>
  )
}
