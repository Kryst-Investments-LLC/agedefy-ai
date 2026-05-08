"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShareButton } from "@/components/share-button"

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ShareAchievementCardProps {
  title: string
  description: string
  icon: string
  unlockedAt: string
  xpReward: number
  /** Base URL for the OG image endpoint */
  baseUrl?: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ShareAchievementCard({
  title,
  description,
  icon,
  unlockedAt,
  xpReward,
  baseUrl,
}: ShareAchievementCardProps) {
  const appUrl = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://biozephyra.com"

  // Build OG-image-aware share URL
  const ogParams = new URLSearchParams({
    template: "achievement",
    title,
    description,
    icon,
  })
  const shareUrl = `${appUrl}/achievements?og=${encodeURIComponent(ogParams.toString())}`

  const iconEmoji =
    icon === "trophy"
      ? "🏆"
      : icon === "flame"
        ? "🔥"
        : icon === "star"
          ? "⭐"
          : icon === "heart"
            ? "❤️"
            : icon === "brain"
              ? "🧠"
              : "🎯"

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-4 text-center">
        <span className="text-5xl">{iconEmoji}</span>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>+{xpReward} XP</span>
          <span>Unlocked {new Date(unlockedAt).toLocaleDateString()}</span>
        </div>
        <ShareButton
          url={shareUrl}
          title={`I unlocked "${title}" on Biozephyra!`}
          text={`🏆 Achievement unlocked: ${title} — ${description}`}
          className="pt-2"
        />
      </CardContent>
    </Card>
  )
}
