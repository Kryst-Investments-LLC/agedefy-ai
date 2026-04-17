"use client"

import { useCallback, useEffect, useState } from "react"
import { Flame, Star, Trophy } from "lucide-react"

interface StreakData {
  type: string
  currentCount: number
  longestCount: number
}

interface XPData {
  totalXP: number
  level: number
  nextLevelXP: number
}

interface AchievementData {
  id: string
  code: string
  title: string
  description: string
  icon: string
  category: string
  unlocked: boolean
  unlockedAt: string | null
}

interface GamificationState {
  xp: XPData
  streaks: StreakData[]
  achievements: AchievementData[]
}

// ---------------------------------------------------------------------------
// Streak Display
// ---------------------------------------------------------------------------

export function StreakDisplay({ streaks }: { streaks: StreakData[] }) {
  const primaryStreak = streaks.reduce(
    (best, s) => (s.currentCount > best.currentCount ? s : best),
    streaks[0] ?? { type: "daily_login", currentCount: 0, longestCount: 0 }
  )

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
      <Flame
        className={`h-6 w-6 ${
          primaryStreak.currentCount > 0 ? "text-orange-500" : "text-muted-foreground"
        }`}
      />
      <div>
        <p className="text-2xl font-bold tabular-nums">
          {primaryStreak.currentCount}
          <span className="text-sm font-normal text-muted-foreground ml-1">day streak</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Best: {primaryStreak.longestCount} days
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// XP Level Bar
// ---------------------------------------------------------------------------

export function XPLevelBar({ xp }: { xp: XPData }) {
  const progress =
    xp.nextLevelXP === Infinity
      ? 100
      : Math.min(100, Math.round((xp.totalXP / xp.nextLevelXP) * 100))

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">Level {xp.level}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {xp.totalXP} / {xp.nextLevelXP === Infinity ? "MAX" : xp.nextLevelXP} XP
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Achievements Grid
// ---------------------------------------------------------------------------

export function AchievementsGrid({
  achievements,
  limit,
}: {
  achievements: AchievementData[]
  limit?: number
}) {
  const displayed = limit ? achievements.slice(0, limit) : achievements

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {displayed.map((a) => (
        <div
          key={a.id}
          className={`rounded-lg border p-3 text-center transition-colors ${
            a.unlocked
              ? "bg-primary/5 border-primary/20"
              : "opacity-40 grayscale"
          }`}
        >
          <Trophy
            className={`h-8 w-8 mx-auto mb-1.5 ${
              a.unlocked ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <p className="text-xs font-medium leading-tight">{a.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {a.unlocked
              ? new Date(a.unlockedAt!).toLocaleDateString()
              : a.description}
          </p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Combined Dashboard Widget
// ---------------------------------------------------------------------------

export function GamificationWidget() {
  const [data, setData] = useState<GamificationState | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/gamification")
      if (!res.ok) return
      setData(await res.json())
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
      <div className="space-y-3 animate-pulse">
        <div className="h-16 bg-muted rounded-lg" />
        <div className="h-12 bg-muted rounded-lg" />
      </div>
    )
  }

  if (!data) return null

  const recentAchievements = data.achievements
    .filter((a) => a.unlocked)
    .sort(
      (a, b) =>
        new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime()
    )
    .slice(0, 4)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StreakDisplay streaks={data.streaks} />
        <XPLevelBar xp={data.xp} />
      </div>
      {recentAchievements.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Achievements</h4>
          <AchievementsGrid achievements={recentAchievements} />
        </div>
      )}
    </div>
  )
}
