"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users, BookOpen, Activity, Shield } from "lucide-react"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface StatsSectionClientProps {
  userCount: number
  researchEntryCount: number
  biomarkerCount: number
  auditLogCount: number
}

export function StatsSectionClient({
  userCount,
  researchEntryCount,
  biomarkerCount,
  auditLogCount,
}: StatsSectionClientProps) {
  const { t } = useTranslation()

  const stats = [
    {
      icon: Users,
      value: userCount,
      label: t("stats.registeredUsers", "Registered users"),
      description: t("stats.registeredUsersDesc", "Authenticated accounts in the database"),
    },
    {
      icon: BookOpen,
      value: researchEntryCount,
      label: t("stats.researchEntries", "Research entries"),
      description: t("stats.researchEntriesDesc", "Articles ingested from PubMed"),
    },
    {
      icon: Activity,
      value: biomarkerCount,
      label: t("stats.biomarkerReadings", "Biomarker readings"),
      description: t("stats.biomarkerReadingsDesc", "Real measurements stored by users"),
    },
    {
      icon: Shield,
      value: auditLogCount,
      label: t("stats.auditEvents", "Audit events"),
      description: t("stats.auditEventsDesc", "Governance events logged to date"),
    },
  ]

  return (
    <section className="py-20 bg-gray-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t("stats.sectionTitle", "Live platform metrics")}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t("stats.sectionDesc", "Real counts queried from the database \u2014 no hardcoded marketing numbers.")}
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
