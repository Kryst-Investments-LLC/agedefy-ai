import { AppShell } from "@/components/app-shell"

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <p className="text-gray-400">Last updated: January 2025</p>

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
              <li>To improve our services through aggregated analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Data Storage & Security</h2>
            <p>Data is stored with encrypted connections. Passwords are hashed with bcrypt (cost factor 12). Authentication tokens are SHA-256 hashed before storage. Stripe handles all payment card data — we never store card numbers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Your Rights (GDPR)</h2>
            <p>You can export all your data as JSON from your Account page. You can permanently delete your account and all associated data. These operations are irreversible once confirmed.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Cookies</h2>
            <p>We use essential cookies for authentication sessions. Optional analytics and personalization cookies are only set with your explicit consent via our cookie banner.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Contact</h2>
            <p>For privacy-related inquiries, contact us at <strong>privacy@biozephyra.com</strong>.</p>
          </section>
        </div>
      </main>
    </div>
    </AppShell>
  )
}
