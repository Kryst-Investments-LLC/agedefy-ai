import { AppShell } from "@/components/app-shell"

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <p className="text-gray-400">Last updated: June 2026</p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Data We Collect</h2>
            <p>Biozephyra collects data you provide directly: account information (name, email, hashed password), health biomarkers you enter, protocols you create, community posts, and research collections.</p>
            <p>We also collect usage data such as pages visited, features used, and timestamps for audit logging. We do <strong>not</strong> sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and personalize the platform</li>
              <li>To process billing and subscriptions via Stripe</li>
              <li>To send transactional emails (password reset, verification, welcome)</li>
              <li>To maintain platform security and generate audit logs</li>
              <li>To improve our services through aggregated, de-identified analytics</li>
            </ul>
            <p>Where required (e.g., GDPR), our legal bases for processing are your consent, performance of our contract with you, our legitimate interests in operating and securing the platform, and compliance with legal obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Sensitive Health Data</h2>
            <p>Biomarkers and related health information are sensitive personal data, and we process them only to provide the features you use. Biozephyra is a consumer research and wellness platform and, except where it explicitly facilitates a regulated service through a licensed provider, is <strong>not</strong> a HIPAA-covered entity. Regulated services (e.g., telemedicine, lab testing) are delivered by independent providers under their own privacy practices.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Service Providers &amp; Sharing</h2>
            <p>We share data only with vendors that process it on our behalf to run the platform, under contractual confidentiality and security obligations, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Payments</strong> — Stripe (billing and card processing; we never store card numbers)</li>
              <li><strong>AI providers</strong> — used to generate AI features; prompts may include content you submit. Do not enter information you do not want processed by an AI vendor.</li>
              <li><strong>Email delivery</strong> — for transactional messages</li>
              <li><strong>Telemedicine &amp; laboratory partners</strong> — only when you request those services</li>
              <li><strong>Public scientific databases</strong> (e.g., PubMed, ClinicalTrials.gov, PubChem, RCSB) — for research content; we send queries, not your identity</li>
            </ul>
            <p>We may also disclose data if required by law or to protect rights, safety, or the integrity of the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Data Storage &amp; Security</h2>
            <p>Data is stored with encrypted connections. Passwords are hashed with bcrypt (cost factor 12). Authentication tokens are SHA-256 hashed before storage. Stripe handles all payment card data — we never store card numbers. No method of transmission or storage is perfectly secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Data Retention</h2>
            <p>We retain your data while your account is active and as needed to provide the service. When you delete your account, we delete or de-identify your personal data, except where retention is required for legal, accounting, security, or audit purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Your Rights (GDPR / UK GDPR)</h2>
            <p>Subject to applicable law, you may access, correct, export, restrict, or delete your data, object to certain processing, and withdraw consent. You can export all your data as JSON and permanently delete your account from your Account page; these operations are irreversible once confirmed. You may also lodge a complaint with your local data-protection authority.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. California Privacy Rights (CCPA/CPRA)</h2>
            <p>California residents have the right to know what personal information we collect, to request deletion, to correct inaccurate information, and to opt out of &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information. We do <strong>not</strong> sell your personal information. You will not be discriminated against for exercising these rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. International Data Transfers</h2>
            <p>We may process and store data in countries other than where you live. Where required, we use appropriate safeguards (such as Standard Contractual Clauses) for cross-border transfers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">10. Children&apos;s Privacy</h2>
            <p>The platform is intended for adults 18 and older. We do not knowingly collect personal information from children. If you believe a child has provided us information, contact us and we will delete it.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">11. Cookies</h2>
            <p>We use essential cookies for authentication sessions. Optional analytics and personalization cookies are only set with your explicit consent via our cookie banner.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">12. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will revise the &ldquo;Last updated&rdquo; date above and, for material changes, provide additional notice where required.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">13. Contact</h2>
            <p>For privacy-related inquiries, contact us at <strong>privacy@biozephyra.com</strong>.</p>
          </section>
        </div>
      </main>
    </div>
    </AppShell>
  )
}
