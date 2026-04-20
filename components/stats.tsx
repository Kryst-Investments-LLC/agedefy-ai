import { db } from "@/lib/db"
import { StatsSectionClient } from "@/components/stats-section-client"

export async function Stats() {
  const [userCount, researchEntryCount, biomarkerCount, auditLogCount] = await Promise.all([
    db.user.count(),
    db.researchEntry.count(),
    db.biomarker.count(),
    db.auditLog.count(),
  ])

  return (
    <StatsSectionClient
      userCount={userCount}
      researchEntryCount={researchEntryCount}
      biomarkerCount={biomarkerCount}
      auditLogCount={auditLogCount}
    />
  )
}
