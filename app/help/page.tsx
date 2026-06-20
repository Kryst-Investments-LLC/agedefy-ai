import { AppShell } from "@/components/app-shell"
import Link from "next/link"

export default function HelpPage() {
  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Help Center</h1>

        <div className="space-y-6 text-gray-300 text-sm">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Getting Started</h2>
            <div className="space-y-3">
              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">How do I create an account?</summary>
                <div className="px-4 pb-4 text-gray-400">
                  Click &ldquo;Get Started&rdquo; in the navigation bar, fill in your name, email, and a password
                  (minimum 12 characters). You&apos;ll be automatically signed in and redirected to your dashboard.
                </div>
              </details>

              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">How do I reset my password?</summary>
                <div className="px-4 pb-4 text-gray-400">
                  Go to the <Link href="/forgot-password" className="text-teal-400 hover:underline">forgot password page</Link>{" "}
                  and enter your email. You&apos;ll receive a reset link valid for 1 hour.
                </div>
              </details>

              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">What data can I track?</summary>
                <div className="px-4 pb-4 text-gray-400">
                  You can track biomarkers (blood work, health metrics) and create health protocols.
                  All data is stored in your personal workspace and can be exported as JSON from your Account page.
                </div>
              </details>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Features</h2>
            <div className="space-y-3">
              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">Compound Mixer</summary>
                <div className="px-4 pb-4 text-gray-400">
                  Search and combine longevity compounds to check for known interactions.
                  The mixer queries our knowledge graph for interaction severity (beneficial, caution, dangerous)
                  and links to supporting research.
                </div>
              </details>

              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">Research & Clinical Trials</summary>
                <div className="px-4 pb-4 text-gray-400">
                  Search PubMed and ClinicalTrials.gov directly from the platform. Save interesting studies
                  to research collections. Research ingestion is available from the dashboard&apos;s Enterprise Operations panel.
                </div>
              </details>

              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">Subscriptions & Billing</summary>
                <div className="px-4 pb-4 text-gray-400">
                  Plus, Clinic & Research, and Enterprise plans unlock premium workflows such as Clinical Trials Explorer and AI Personalization.
                  Lab panels and telemedicine consults are billed separately and are never bundled into the subscription price.
                  Visit <Link href="/pricing" className="text-teal-400 hover:underline">Pricing</Link> to compare plans.
                  Manage your subscription from your Account page.
                </div>
              </details>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Data & Privacy</h2>
            <div className="space-y-3">
              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">How do I export my data?</summary>
                <div className="px-4 pb-4 text-gray-400">
                  Go to your <Link href="/account" className="text-teal-400 hover:underline">Account page</Link> and
                  use the &ldquo;Export Data&rdquo; button. This downloads all your data as a JSON file immediately.
                </div>
              </details>

              <details className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <summary className="p-4 cursor-pointer text-white hover:text-teal-400">How do I delete my account?</summary>
                <div className="px-4 pb-4 text-gray-400">
                  From your Account page, use the &ldquo;Delete Account&rdquo; option. This permanently removes all your
                  data from our systems. This action is irreversible.
                </div>
              </details>
            </div>
          </section>
        </div>
      </main>
    </div>
    </AppShell>
  )
}
