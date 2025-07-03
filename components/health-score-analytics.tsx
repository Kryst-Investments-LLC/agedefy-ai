'use client';

import { Target, TrendingUp, Award, Calendar } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface HealthMetric {
  name: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  icon: string;
}

export function HealthScoreAnalytics() {
  const overallScore = 8.2;
  const level = Math.floor(overallScore);
  const levelProgress = (overallScore - level) * 100;

  const metrics: HealthMetric[] = [
    { name: 'Longevity Score', value: 8.5, trend: 'up', change: 0.2 },
    { name: 'Optimization Score', value: 7.8, trend: 'up', change: 0.1 },
    { name: 'Consistency Score', value: 8.2, trend: 'stable', change: 0.0 },
    { name: 'Biomarker Score', value: 7.9, trend: 'up', change: 0.3 },
  ];

  const achievements: Achievement[] = [
    {
      id: '1',
      title: 'Health Pioneer',
      description: 'Complete your first health assessment',
      unlocked: true,
      progress: 100,
      icon: '🎯',
    },
    {
      id: '2',
      title: 'Consistency Champion',
      description: 'Maintain daily tracking for 30 days',
      unlocked: true,
      progress: 100,
      icon: '📅',
    },
    {
      id: '3',
      title: 'Optimization Expert',
      description: 'Reach health score of 8.0+',
      unlocked: true,
      progress: 100,
      icon: '⚡',
    },
    {
      id: '4',
      title: 'Longevity Master',
      description: 'Achieve perfect 10.0 health score',
      unlocked: false,
      progress: 82,
      icon: '🏆',
    },
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-400" />;
      case 'down':
        return <TrendingUp className="h-3 w-3 text-red-400 rotate-180" />;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            Health Score Analytics
          </CardTitle>
          <CardDescription>Your comprehensive longevity metrics and progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-600"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-teal-400"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${overallScore * 10}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-teal-300">{overallScore}</div>
                    <div className="text-xs text-gray-400">Health Score</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">
                  Level {level} - Advanced Optimizer
                </Badge>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span>Progress to Level {level + 1}:</span>
                  <Progress value={levelProgress} className="flex-1 max-w-24" />
                  <span>{levelProgress.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {metrics.map((metric) => (
                <div key={metric.name} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-300">{metric.name}</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-xs ${getTrendColor(metric.trend)}`}>
                        {metric.change > 0 ? '+' : ''}{metric.change}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={metric.value * 10} className="flex-1" />
                    <span className="text-white font-medium text-sm">{metric.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Award className="h-5 w-5" />
            Achievements
          </CardTitle>
          <CardDescription>Your health optimization milestones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border ${
                  achievement.unlocked
                    ? 'bg-teal-900/20 border-teal-500/20'
                    : 'bg-gray-700/50 border-gray-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{achievement.icon}</div>
                  <div className="flex-1">
                    <h4 className={`font-medium ${achievement.unlocked ? 'text-teal-300' : 'text-gray-300'}`}>
                      {achievement.title}
                    </h4>
                    <p className="text-sm text-gray-400 mb-2">{achievement.description}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={achievement.progress} className="flex-1" />
                      <span className="text-xs text-gray-400">{achievement.progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Goals
          </CardTitle>
          <CardDescription>Stay on track with your health optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Complete daily biomarker tracking</span>
              <div className="flex items-center gap-2">
                <Progress value={85} className="w-16" />
                <span className="text-sm text-gray-400">6/7 days</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Maintain supplement consistency</span>
              <div className="flex items-center gap-2">
                <Progress value={100} className="w-16" />
                <span className="text-sm text-gray-400">7/7 days</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Review research updates</span>
              <div className="flex items-center gap-2">
                <Progress value={60} className="w-16" />
                <span className="text-sm text-gray-400">3/5 articles</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
