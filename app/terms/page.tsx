import { AppShell } from "@/components/app-shell"

export default function TermsPage() {
  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <p className="text-gray-400">Last updated: June 2026</p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Acceptance</h2>
            <p>By accessing or using Biozephyra, you agree to be bound by these Terms of Service and our <a href="/privacy" className="text-teal-400 hover:underline">Privacy Policy</a> and <a href="/disclaimer" className="text-teal-400 hover:underline">Medical Disclaimer</a>. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Eligibility</h2>
            <p>You must be at least 18 years old and able to form a binding contract to use Biozephyra. The platform is not directed to children, and we do not knowingly collect information from anyone under 18.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Description of Service</h2>
            <p>Biozephyra is a longevity science research and tracking platform. It provides tools for biomarker tracking, compound research, community discussion, and evidence-based protocol management. It is <strong>not</strong> a medical service, medical device, or healthcare provider, and it does not provide medical advice, diagnosis, or treatment.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. No Doctor–Patient Relationship</h2>
            <p>Use of Biozephyra does not create a doctor–patient or other professional relationship. Telemedicine consultations, lab orders, and clinician interactions are provided by independent, licensed third-party providers who are solely responsible for their services. You agree to consult a qualified healthcare professional before acting on any information from the platform. See our <a href="/disclaimer" className="text-teal-400 hover:underline">Medical Disclaimer</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate registration information</li>
              <li>You are responsible for maintaining your account security</li>
              <li>You must not use the platform for illegal purposes or to harm others</li>
              <li>You must not misuse, scrape, reverse-engineer, or attempt to disrupt the platform</li>
              <li>Community contributions must follow our safety guidelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Subscriptions &amp; Billing</h2>
            <p>Subscription access is processed through Stripe and may include trial periods and capped AI allowances with optional paid top-ups. Telemedicine consults, lab panels, and marketplace transaction fees are billed separately from the subscription. Cancellation can be done through your account&apos;s billing portal. Refunds are handled per our billing provider&apos;s policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Third-Party Services</h2>
            <p>The platform integrates third-party services (including payment processing, AI providers, email delivery, telemedicine providers, laboratory partners, and public scientific databases). We are not responsible for the acts, omissions, content, or availability of third parties, and your use of their services may be governed by their own terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Intellectual Property</h2>
            <p>Content you create (biomarker entries, protocols, posts) remains yours, and you grant us a limited license to host and display it to operate the platform. The Biozephyra platform, its design, and proprietary features are owned by Biozephyra and protected by applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. Disclaimer of Warranties</h2>
            <p>The platform and all content are provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not warrant that the platform will be uninterrupted, error-free, or that information is complete or current.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">10. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Biozephyra and its operators, officers, employees, and affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any health outcomes, arising from your use of the platform. Our total aggregate liability for any claim will not exceed the greater of the amounts you paid us in the twelve months before the claim or USD 100. See our <a href="/disclaimer" className="text-teal-400 hover:underline">Medical Disclaimer</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">11. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Biozephyra and its operators from any claims, damages, liabilities, and expenses (including reasonable legal fees) arising from your use of the platform, your content, or your violation of these terms or applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">12. Termination</h2>
            <p>We may suspend or terminate your access at any time for any violation of these terms or to protect the platform or its users. You may stop using the platform and delete your account at any time from your Account page.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">13. Governing Law &amp; Dispute Resolution</h2>
            <p>These terms are governed by the laws of <strong>[Insert governing jurisdiction]</strong>, without regard to conflict-of-law rules. Any dispute will be resolved in the courts of, or by binding arbitration seated in, <strong>[Insert venue]</strong>, and you waive participation in any class action to the extent permitted by law. <em>(Jurisdiction, venue, and arbitration terms must be confirmed by counsel for your operating entity.)</em></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">14. Changes</h2>
            <p>We may update these terms at any time. We will update the &ldquo;Last updated&rdquo; date above, and continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">15. Severability &amp; Entire Agreement</h2>
            <p>If any provision is held unenforceable, the remaining provisions stay in effect. These terms, together with the Privacy Policy and Medical Disclaimer, are the entire agreement between you and Biozephyra regarding the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">16. Contact</h2>
            <p>Questions about these terms: <strong>legal@biozephyra.com</strong>.</p>
          </section>
        </div>
      </main>
    </div>
    </AppShell>
  )
}
