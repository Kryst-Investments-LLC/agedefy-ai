import { AppShell } from "@/components/app-shell"

export default function ContactPage() {
  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-8">Contact Us</h1>

        <div className="space-y-8 text-muted-foreground text-sm">
          <p>
            Have questions, feedback, or need support? Reach out through the channels below.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card/50 border border-border rounded-lg p-6">
              <h2 className="text-foreground font-semibold mb-2">General Support</h2>
              <p className="text-muted-foreground mb-3">Platform questions, account help, and feature requests.</p>
              <p className="text-teal-600 dark:text-teal-400">support@biozephyra.com</p>
            </div>

            <div className="bg-card/50 border border-border rounded-lg p-6">
              <h2 className="text-foreground font-semibold mb-2">Privacy & Data</h2>
              <p className="text-muted-foreground mb-3">Data export, deletion, or privacy-related inquiries (GDPR).</p>
              <p className="text-teal-600 dark:text-teal-400">privacy@biozephyra.com</p>
            </div>

            <div className="bg-card/50 border border-border rounded-lg p-6">
              <h2 className="text-foreground font-semibold mb-2">Research Partnerships</h2>
              <p className="text-muted-foreground mb-3">Collaborations, data partnerships, lab integrations.</p>
              <p className="text-teal-600 dark:text-teal-400">research@biozephyra.com</p>
            </div>

            <div className="bg-card/50 border border-border rounded-lg p-6">
              <h2 className="text-foreground font-semibold mb-2">Security</h2>
              <p className="text-muted-foreground mb-3">Report security vulnerabilities responsibly.</p>
              <p className="text-teal-600 dark:text-teal-400">security@biozephyra.com</p>
            </div>
          </div>

          <div className="bg-card/30 border border-border rounded-lg p-6">
            <h2 className="text-foreground font-semibold mb-2">Community</h2>
            <p className="text-muted-foreground">
              For discussions, questions about compounds, protocols, or longevity research,
              visit the{" "}
              <a href="/community" className="text-teal-600 dark:text-teal-400 hover:underline">Community Forum</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
    </AppShell>
  )
}
