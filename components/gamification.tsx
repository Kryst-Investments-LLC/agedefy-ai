"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Star, Target, Zap, Crown, Medal, Gift, Users } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function Gamification() {
  const { t } = useTranslation()
  const [selectedChallenge, setSelectedChallenge] = useState("longevity-streak")

  const playerStats = {
    level: 23,
    xp: 8750,
    nextLevelXp: 10000,
    totalPoints: 45230,
    rank: 156,
    streak: 28
  }

  const achievements = [
    {
      id: "first-biomarker",
      name: "First Biomarker Test",
      description: "Complete your first comprehensive biomarker analysis",
      icon: Star,
      earned: true,
      points: 500,
      rarity: "common",
      date: "2024-11-15"
    },
    {
      id: "supplement-master",
      name: "Supplement Master",
      description: "Maintain supplement routine for 30 consecutive days",
      icon: Medal,
      earned: true,
      points: 1000,
      rarity: "rare",
      date: "2024-12-01"
    },
    {
      id: "longevity-scholar",
      name: "Longevity Scholar",
      description: "Read 50 research papers on aging science",
      icon: Crown,
      earned: false,
      points: 2000,
      rarity: "epic",
      progress: 34
    },
    {
      id: "community-leader",
      name: "Community Leader",
      description: "Help 100 community members with advice",
      icon: Users,
      earned: false,
      points: 1500,
      rarity: "rare",
      progress: 67
    }
  ]

  const activeChallenges = [
    {
      id: "longevity-streak",
      name: "28-Day Longevity Streak",
      description: "Complete daily health optimization tasks for 28 days",
      progress: 18,
      target: 28,
      reward: "1500 XP + Exclusive Badge",
      timeLeft: "10 days",
      difficulty: "Medium"
    },
    {
      id: "biomarker-improvement",
      name: "Biomarker Improvement Challenge",
      description: "Improve 3 key biomarkers by 10% in 90 days",
      progress: 2,
      target: 3,
      reward: "3000 XP + Premium Consultation",
      timeLeft: "45 days",
      difficulty: "Hard"
    },
    {
      id: "knowledge-quest",
      name: "Knowledge Quest",
      description: "Complete 10 educational modules this month",
      progress: 7,
      target: 10,
      reward: "800 XP + Research Access",
      timeLeft: "12 days",
      difficulty: "Easy"
    }
  ]

  const leaderboard = [
    { rank: 1, name: "Dr. Sarah Chen", level: 45, points: 125000, badge: "Longevity Master" },
    { rank: 2, name: "Mike Rodriguez", level: 42, points: 118500, badge: "Biohacker Elite" },
    { rank: 3, name: "Lisa Thompson", level: 39, points: 112300, badge: "Wellness Guru" },
    { rank: 4, name: "Alex Kim", level: 38, points: 109800, badge: "Health Optimizer" },
    { rank: 5, name: "Emma Wilson", level: 36, points: 105600, badge: "Longevity Enthusiast" }
  ]

  const rewards = [
    {
      name: "Premium Lab Testing",
      cost: 5000,
      description: "Comprehensive biomarker panel worth $500",
      available: true,
      category: "Health"
    },
    {
      name: "1-on-1 Consultation",
      cost: 3000,
      description: "30-minute session with longevity expert",
      available: true,
      category: "Consultation"
    },
    {
      name: "Exclusive Research Access",
      cost: 2000,
      description: "Early access to cutting-edge longevity research",
      available: true,
      category: "Knowledge"
    },
    {
      name: "Custom Supplement Stack",
      cost: 4000,
      description: "Personalized supplement recommendations",
      available: false,
      category: "Products"
    }
  ]

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "text-gray-400"
      case "rare": return "text-blue-400"
      case "epic": return "text-purple-400"
      case "legendary": return "text-yellow-400"
      default: return "text-gray-400"
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "Medium": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "Hard": return "bg-red-600/20 text-red-300 border-red-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Gamification</h2>
        <p className="text-gray-400">Level up your longevity journey with achievements and challenges</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">Level {playerStats.level}</div>
            <p className="text-gray-400 text-sm">Current Level</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{playerStats.totalPoints.toLocaleString()}</div>
            <p className="text-gray-400 text-sm">Total Points</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">#{playerStats.rank}</div>
            <p className="text-gray-400 text-sm">Global Rank</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{playerStats.streak}</div>
            <p className="text-gray-400 text-sm">Day Streak</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Experience Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Level {playerStats.level}</span>
              <span className="text-white">{playerStats.xp} / {playerStats.nextLevelXp} XP</span>
            </div>
            <Progress value={(playerStats.xp / playerStats.nextLevelXp) * 100} className="h-3" />
            <p className="text-gray-400 text-sm">{playerStats.nextLevelXp - playerStats.xp} XP to next level</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="challenges" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="challenges" className="text-gray-300">Active Challenges</TabsTrigger>
          <TabsTrigger value="achievements" className="text-gray-300">Achievements</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-gray-300">Leaderboard</TabsTrigger>
          <TabsTrigger value="rewards" className="text-gray-300">Rewards Store</TabsTrigger>
        </TabsList>

        <TabsContent value="challenges" className="space-y-4">
          <div className="space-y-4">
            {activeChallenges.map((challenge) => (
              <Card 
                key={challenge.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedChallenge === challenge.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedChallenge(challenge.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-400" />
                      {challenge.name}
                    </CardTitle>
                    <Badge className={getDifficultyColor(challenge.difficulty)}>
                      {challenge.difficulty}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {challenge.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white">{challenge.progress} / {challenge.target}</span>
                      </div>
                      <Progress value={(challenge.progress / challenge.target) * 100} className="h-2" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400">Reward: </span>
                        <span className="text-green-400">{challenge.reward}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Time Left: </span>
                        <span className="text-white">{challenge.timeLeft}</span>
                      </div>
                    </div>

                    <Button className="w-full bg-teal-600 hover:bg-teal-700">
                      View Challenge Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <Card key={achievement.id} className={`bg-gray-800/50 border-gray-700 ${achievement.earned ? 'ring-1 ring-yellow-500/50' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <achievement.icon className={`h-5 w-5 ${achievement.earned ? 'text-yellow-400' : 'text-gray-500'}`} />
                      {achievement.name}
                    </CardTitle>
                    <Badge className={`${getRarityColor(achievement.rarity)} bg-transparent border-current`}>
                      {achievement.rarity}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {achievement.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Points</span>
                      <span className="text-green-400 font-bold">+{achievement.points}</span>
                    </div>
                    
                    {achievement.earned ? (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Earned</span>
                        <span className="text-white">{achievement.date}</span>
                      </div>
                    ) : achievement.progress !== undefined ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Progress</span>
                          <span className="text-white">{achievement.progress}%</span>
                        </div>
                        <Progress value={achievement.progress} className="h-2" />
                      </div>
                    ) : (
                      <Badge variant="secondary">Locked</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <div className="space-y-4">
            {leaderboard.map((player) => (
              <Card key={player.rank} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        player.rank === 1 ? 'bg-yellow-500 text-black' :
                        player.rank === 2 ? 'bg-gray-400 text-black' :
                        player.rank === 3 ? 'bg-orange-500 text-black' :
                        'bg-gray-600 text-white'
                      }`}>
                        {player.rank}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{player.name}</h4>
                        <p className="text-gray-400 text-sm">{player.badge}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">Level {player.level}</div>
                      <div className="text-gray-400 text-sm">{player.points.toLocaleString()} pts</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((reward, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Gift className="h-5 w-5 text-purple-400" />
                      {reward.name}
                    </CardTitle>
                    <Badge variant="secondary">{reward.category}</Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {reward.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Cost</span>
                      <span className="text-yellow-400 font-bold">{reward.cost.toLocaleString()} pts</span>
                    </div>
                    
                    <Button 
                      className={`w-full ${
                        reward.available && playerStats.totalPoints >= reward.cost
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-600 cursor-not-allowed'
                      }`}
                      disabled={!reward.available || playerStats.totalPoints < reward.cost}
                    >
                      {!reward.available ? 'Coming Soon' : 
                       playerStats.totalPoints < reward.cost ? 'Insufficient Points' : 'Redeem'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
