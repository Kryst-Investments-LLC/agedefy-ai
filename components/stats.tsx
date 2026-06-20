import { db } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Users, BookOpen, Activity, Shield } from "lucide-react"

export async function Stats() {
  const [userCount, researchEntryCount, biomarkerCount, auditLogCount] = await Promise.all([
    db.user.count(),
    db.researchEntry.count(),
    db.biomarker.count(),
    db.auditLog.count(),
  ])

  // Each metric is shown only once it crosses a credibility threshold, so early
  // /low counts aren't displayed publicly. The whole section is hidden until at
  // least one metric qualifies. Tune thresholds as the platform grows.
  const stats = [
    {
      icon: Users,
      value: userCount,
      label: "Registered users",
      description: "Authenticated accounts in the database",
      min: 100,
    },
    {
      icon: BookOpen,
      value: researchEntryCount,
      label: "Research entries",
      description: "Articles ingested from PubMed",
      min: 100,
    },
    {
      icon: Activity,
      value: biomarkerCount,
      label: "Biomarker readings",
      description: "Real measurements stored by users",
      min: 1000,
    },
    {
      icon: Shield,
      value: auditLogCount,
      label: "Audit events",
      description: "Governance events logged to date",
      min: 1000,
    },
  ].filter((stat) => stat.value >= stat.min)

  // Nothing meaningful to show yet — hide the entire section.
  if (stats.length === 0) return null

  return (
    <section className="py-20 bg-gray-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Live platform metrics</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Real counts queried from the database — no hardcoded marketing numbers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300 group"
            >
              <CardContent className="p-6 text-center">
                <div className="bg-teal-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-500 transition-colors">
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stat.value.toLocaleString()}
                </div>
                <div className="text-teal-400 font-medium mb-2">{stat.label}</div>
                <div className="text-gray-400 text-sm">{stat.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
