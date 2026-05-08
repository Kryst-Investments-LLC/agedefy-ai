import { Navigation } from "@/components/navigation"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <p className="text-gray-400">Last updated: January 2025</p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Acceptance</h2>
            <p>By using Biozephyra, you agree to these terms. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Description of Service</h2>
            <p>Biozephyra is a longevity science research and tracking platform. It provides tools for biomarker tracking, compound research, community discussion, and evidence-based protocol management. It is <strong>not</strong> a medical service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate registration information</li>
              <li>You are responsible for maintaining your account security</li>
              <li>You must not use the platform for illegal purposes</li>
              <li>Community contributions must follow our safety guidelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Subscriptions & Billing</h2>
            <p>Subscription access is processed through Stripe and may include trial periods, fixed regional price books, and capped AI allowances with optional paid top-ups. Telemedicine consults, lab panels, and marketplace transaction fees are billed separately from the subscription. Cancellation can be done through your account&apos;s billing portal. Refunds are handled per our billing provider&apos;s policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Intellectual Property</h2>
            <p>Content you create (biomarker entries, protocols, posts) remains yours. The Biozephyra platform, its design, and proprietary features are owned by Biozephyra.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Limitation of Liability</h2>
            <p>Biozephyra is provided &ldquo;as is.&rdquo; We are not liable for any health outcomes resulting from information accessed through this platform. See our Medical Disclaimer for details.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Changes</h2>
            <p>We may update these terms at any time. Continued use after changes constitutes acceptance.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
