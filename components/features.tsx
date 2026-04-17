import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Shield,
  Activity,
  Lock,
  DollarSign,
  ClipboardList,
  Database,
  Stethoscope,
  TestTube,
  Users,
  FlaskConical,
  Route,
  Brain,
  BookOpen,
  Microscope,
  Mail,
} from "lucide-react"

const features = [
  {
    icon: Shield,
    title: "Real Authentication & RBAC",
    description: "Credential-based sign-up, protected routes, and role-based access for members, admins, clinicians, and researchers.",
    status: "Live",
    href: "/sign-up",
  },
  {
    icon: Activity,
    title: "Biomarker & Protocol Tracking",
    description: "Create, store, and delete real biomarker readings and intervention protocols in a persistent database.",
    status: "Live",
    href: "/dashboard",
  },
  {
    icon: DollarSign,
    title: "Stripe Billing & Entitlements",
    description: "Checkout sessions, webhook-synced subscriptions, customer portal self-service, and entitlement-gated routes.",
    status: "Live",
    href: "/pricing",
  },
  {
    icon: Search,
    title: "PubMed Research Ingestion",
    description: "Search PubMed via E-utilities, fetch summaries and abstracts, and persist articles into research collections.",
    status: "Live",
    href: "/research",
  },
  {
    icon: ClipboardList,
    title: "Clinician Workflow Tasks",
    description: "Create, track, and complete clinical review tasks with priority and status transitions.",
    status: "Live",
    href: "/dashboard",
  },
  {
    icon: Database,
    title: "Partner Data Ingestion",
    description: "Submit and store lab, wearable, genomics, or custom payloads from external partners.",
    status: "Live",
    href: "/dashboard",
  },
  {
    icon: Lock,
    title: "Audit Logging & Admin Console",
    description: "Immutable audit trail, filterable review queue, CSV export, and admin-only governance workspace.",
    status: "Live",
    href: "/admin",
  },
  {
    icon: Stethoscope,
    title: "ClinicalTrials.gov Ingestion",
    description: "Search and persist clinical trial records from ClinicalTrials.gov for connected evidence tracking.",
    status: "Live",
    href: "/research",
  },
  {
    icon: TestTube,
    title: "Compound Mixer & Interaction Checker",
    description: "Browse 12+ longevity compounds, build stacks, and check known interactions across pathways.",
    status: "Live",
    href: "/mixer",
  },
  {
    icon: Users,
    title: "Community Discussions",
    description: "Authenticated community forum with category filters, moderation audit, and rate-limited posting.",
    status: "Live",
    href: "/community",
  },
  {
    icon: FlaskConical,
    title: "Lab Testing & Panel Ordering",
    description: "Browse 6 curated longevity panels, place lab orders, and track results — backed by real database records.",
    status: "Live",
    href: "/lab-testing",
  },
  {
    icon: Route,
    title: "Pathway Knowledge Graph",
    description: "Explore 10+ aging pathways with compound links, biomarker effects, and interaction data.",
    status: "Live",
    href: "/pathways",
  },
  {
    icon: Brain,
    title: "AI Health Coach & Personalization",
    description: "Premium AI-powered longevity recommendations using your biomarker data, protocols, and the knowledge graph.",
    status: "Live",
    href: "/personalization",
  },
  {
    icon: BookOpen,
    title: "Learning Center",
    description: "Curated articles on longevity science, supplementation, and aging biology — searchable and categorized.",
    status: "Live",
    href: "/learn",
  },
  {
    icon: Microscope,
    title: "Clinical Trials Explorer",
    description: "Search and browse active clinical trials from ClinicalTrials.gov with real-time API integration.",
    status: "Live",
    href: "/clinical-trials",
  },
  {
    icon: Mail,
    title: "Email & Account Security",
    description: "Email verification, password reset with secure tokens, and full account data export and deletion.",
    status: "Live",
    href: "/account",
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "Live":
      return "bg-green-600/20 text-green-300 border-green-500/20"
    case "In progress":
      return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
    case "Planned":
      return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    default:
      return "bg-gray-600/20 text-gray-300 border-gray-500/20"
  }
}

export function Features() {
  return (
    <section className="py-20 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">What is actually built</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Every feature listed here is wired to real code, real APIs, and a real database. Nothing is simulated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="h-full bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300 group hover:shadow-2xl hover:shadow-teal-500/10">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-500 transition-colors">
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <Badge className={getStatusColor(feature.status)} variant="outline">
                      {feature.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-gray-400 text-sm">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 rounded-2xl p-8 border border-teal-500/20">
            <h3 className="text-2xl font-bold text-white mb-4">Start building your longevity workspace</h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Create a real account, track real biomarkers, ingest real research, and manage billing — all backed by persistent storage and enterprise controls.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-up" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-lg font-medium transition-colors">
                Create account
              </Link>
              <Link href="/dashboard" className="border border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white px-8 py-3 rounded-lg font-medium transition-colors">
                Open dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
