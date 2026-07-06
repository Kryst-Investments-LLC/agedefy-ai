"use client"

import { useCallback, useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import {
  AchievementsGrid,
  XPLevelBar,
  StreakDisplay,
} from "@/components/gamification/gamification-widgets"

interface AchievementData {
  id: string
  code: string
  title: string
  description: string
  icon: string
  category: string
  threshold: number
  xpReward: number
  unlocked: boolean
  unlockedAt: string | null
}

interface XPData {
  totalXP: number
  level: number
  nextLevelXP: number
}

interface StreakData {
  type: string
  currentCount: number
  longestCount: number
}

const CATEGORY_LABELS: Record<string, string> = {
  consistency: "Consistency",
  knowledge: "Knowledge",
  community: "Community",
  science: "Science",
  health: "Health Milestones",
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementData[]>([])
  const [xp, setXP] = useState<XPData>({ totalXP: 0, level: 1, nextLevelXP: 100 })
  const [streaks, setStreaks] = useState<StreakData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/gamification")
      if (!res.ok) return
      const data = await res.json()
      setAchievements(data.achievements ?? [])
      setXP(data.xp ?? { totalXP: 0, level: 1, nextLevelXP: 100 })
      setStreaks(data.streaks ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <AppShell pageTitle="Achievements">
        <div className="container mx-auto max-w-4xl py-8 px-4 animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-24 bg-muted rounded-lg" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalCount = achievements.length

  // Group by category
  const categories = Object.keys(CATEGORY_LABELS)
  const grouped = categories
    .map((cat) => ({
      key: cat,
      label: CATEGORY_LABELS[cat],
      items: achievements.filter((a) => a.category === cat),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <AppShell pageTitle="Achievements">
      <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            {unlockedCount} of {totalCount} unlocked
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <XPLevelBar xp={xp} />
          <StreakDisplay streaks={streaks} />
        </div>

        {grouped.map((group) => (
          <section key={group.key}>
            <h2 className="text-lg font-semibold mb-3">{group.label}</h2>
            <AchievementsGrid achievements={group.items} />
          </section>
        ))}
      </div>
    </AppShell>
  )
}
