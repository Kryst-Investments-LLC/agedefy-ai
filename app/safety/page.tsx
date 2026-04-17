import { Navigation } from "@/components/navigation"

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Safety Guidelines</h1>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-300 font-semibold text-base">Health & Safety First</p>
            <p className="text-red-200/80 mt-1">
              Self-experimentation with longevity compounds carries real risks. These guidelines exist to help you
              use this platform responsibly.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Always Consult a Professional</h2>
            <p>
              Before starting any new supplement, peptide, or medication protocol, discuss it with a qualified
              healthcare provider. Share your biomarker data and planned protocol for professional review.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Check Interactions</h2>
            <p>
              Use the Compound Mixer to check for known interactions before combining compounds.
              Pay special attention to <strong className="text-red-400">DANGEROUS</strong> and{" "}
              <strong className="text-yellow-400">CAUTION</strong> severity ratings. Our database is not exhaustive —
              absence of a listed interaction does not guarantee safety.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Start Low, Go Slow</h2>
            <p>
              When trying any new compound, start with the lowest effective dose and increase gradually.
              Monitor your biomarkers before, during, and after changes to track effects.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Track Everything</h2>
            <p>
              Log biomarkers consistently. Use the dashboard&apos;s tracking and trend features to detect changes early.
              Unexplained changes in your biomarkers should prompt a conversation with your doctor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Community Guidelines</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do not give or solicit specific medical advice in community posts</li>
              <li>Share experiences with appropriate caveats about individual variation</li>
              <li>Report unsafe or misleading content to moderators</li>
              <li>Respect that others&apos; risk tolerance may differ from yours</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. AI Limitations</h2>
            <p>
              AI features on this platform are for educational exploration, not clinical guidance.
              Language models can produce plausible-sounding but incorrect information.
              Always verify AI suggestions against peer-reviewed research.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
