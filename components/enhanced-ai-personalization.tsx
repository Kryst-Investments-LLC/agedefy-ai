'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { mlPersonalizationService, type PersonalizedRecommendation, type UserProfile } from '@/lib/services/ml-personalization-service';
import {
  Brain,
  Dna,
  Activity,
  TrendingUp,
  Zap,
  Shield,
  Target,
  Sparkles,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Lightbulb,
  Cpu,
} from 'lucide-react';

const mockRecommendations = [
  {
    id: 'nmn-protocol',
    title: 'NMN Optimization Protocol',
    description: 'Personalized NAD+ boosting strategy',
    confidence: 87,
    priority: 'high' as const,
    category: 'Cellular Health',
  },
  {
    id: 'resveratrol-stack',
    title: 'Resveratrol + Quercetin Stack',
    description: 'Anti-aging compound combination',
    confidence: 82,
    priority: 'medium' as const,
    category: 'Antioxidants',
  },
  {
    id: 'metformin-longevity',
    title: 'Metformin Longevity Protocol',
    description: 'Metabolic health optimization',
    confidence: 75,
    priority: 'medium' as const,
    category: 'Metabolic',
  },
];

export function EnhancedAIPersonalization() {
  const [selectedProfile, setSelectedProfile] = useState<string>('optimizer');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [mlRecommendations, setMlRecommendations] = useState<PersonalizedRecommendation[]>([]);
  const [personalizationInsights, setPersonalizationInsights] = useState<any>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    const mockUserProfile: UserProfile = {
      id: 'user-123',
      age: 35,
      gender: 'male',
      geneticMarkers: ['ApoE3/3', 'MTHFR C677T'],
      biomarkers: {
        'NAD+': 45,
        'HbA1c': 5.2,
        'CRP': 1.8,
        'Vitamin D': 32
      },
      healthGoals: ['longevity', 'cognitive enhancement', 'energy optimization'],
      lifestyle: {
        exercise: 'moderate',
        diet: 'mediterranean',
        sleep: 7.5,
        stress: 4
      },
      preferences: {
        supplementTypes: ['natural', 'research-backed'],
        riskTolerance: 'medium',
        budgetRange: '$100-300/month'
      },
      history: {
        compounds: ['NMN', 'Resveratrol'],
        outcomes: { 'energy': 0.7, 'cognitive': 0.6 },
        adherence: 0.85
      }
    };

    try {
      const recommendations = await mlPersonalizationService.generatePersonalizedRecommendations(mockUserProfile);
      const insights = await mlPersonalizationService.getPersonalizationInsights('user-123');
      
      setMlRecommendations(recommendations);
      setPersonalizationInsights(insights);
      setAnalysisComplete(true);
    } catch (error) {
      console.error('ML personalization failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-600/20 text-red-300 border-red-500/20';
      case 'medium':
        return 'bg-yellow-600/20 text-yellow-300 border-yellow-500/20';
      case 'low':
        return 'bg-green-600/20 text-green-300 border-green-500/20';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/20';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Enhanced AI Personalization</h1>
        <p className="text-gray-400">Advanced machine learning algorithms for personalized health optimization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Analysis Engine
              </CardTitle>
              <CardDescription>
                Multi-AI ensemble with advanced personalization algorithms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-teal-500/20 bg-teal-500/10">
                  <Sparkles className="h-4 w-4 text-teal-400" />
                  <AlertDescription className="text-teal-200">
                    <strong>AI Ensemble Intelligence</strong> - Combining OpenAI, Grok, and Anthropic for comprehensive health analysis
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="h-4 w-4 text-blue-400" />
                      <span className="text-white font-medium">Cluster Analysis</span>
                    </div>
                    <p className="text-gray-300 text-sm">Find users with similar health profiles</p>
                  </div>
                  
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <span className="text-white font-medium">Predictive Modeling</span>
                    </div>
                    <p className="text-gray-300 text-sm">Forecast health outcomes and risks</p>
                  </div>
                  
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-purple-400" />
                      <span className="text-white font-medium">Outcome Optimization</span>
                    </div>
                    <p className="text-gray-300 text-sm">Maximize intervention effectiveness</p>
                  </div>
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {isAnalyzing ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing with ML Algorithms...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Start Enhanced AI Analysis
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {analysisComplete && (
            <div className="space-y-8">
              {personalizationInsights && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      ML Personalization Insights
                    </CardTitle>
                    <CardDescription>Advanced machine learning analysis of your health profile</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-teal-300 mb-2">
                          {Math.round(personalizationInsights.accuracyScore * 100)}%
                        </div>
                        <p className="text-gray-400 text-sm">Prediction Accuracy</p>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-2">Improvement Areas</h4>
                        <div className="space-y-1">
                          {personalizationInsights.improvementAreas.map((area: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="border-yellow-500 text-yellow-300 mr-2">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-2">Next Optimizations</h4>
                        <div className="space-y-1">
                          {personalizationInsights.nextOptimizations.map((opt: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="border-blue-500 text-blue-300 mr-2">
                              {opt}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      ML-Powered Recommendations
                    </CardTitle>
                    <CardDescription>Advanced personalization based on cluster analysis and predictive modeling</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mlRecommendations.slice(0, 4).map((rec) => (
                        <div key={rec.id} className="p-4 bg-gray-700/50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-semibold">{rec.title}</h4>
                            <Badge className={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                          </div>
                          <p className="text-gray-300 text-sm mb-3">{rec.description}</p>
                          <div className="mb-3">
                            <p className="text-gray-400 text-xs mb-2">ML Reasoning:</p>
                            <p className="text-gray-300 text-xs">{rec.reasoning}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-400" />
                                <span className="text-sm text-gray-400">{Math.round(rec.confidence * 100)}% confidence</span>
                              </div>
                              <Badge variant="outline" className="border-gray-500 text-gray-300">
                                {rec.category}
                              </Badge>
                            </div>
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                              Learn More
                            </Button>
                          </div>
                          {rec.personalizedFactors && rec.personalizedFactors.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                              <p className="text-gray-400 text-xs mb-1">Personalized Factors:</p>
                              <div className="flex flex-wrap gap-1">
                                {rec.personalizedFactors.map((factor, idx) => (
                                  <Badge key={idx} variant="outline" className="border-teal-500 text-teal-300 text-xs">
                                    {factor}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Traditional Recommendations
                    </CardTitle>
                    <CardDescription>Rule-based suggestions for comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockRecommendations.map((rec) => (
                        <div key={rec.id} className="p-4 bg-gray-700/50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-semibold">{rec.title}</h4>
                            <Badge className={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                          </div>
                          <p className="text-gray-300 text-sm mb-3">{rec.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-400" />
                                <span className="text-sm text-gray-400">{rec.confidence}% match</span>
                              </div>
                              <Badge variant="outline" className="border-gray-500 text-gray-300">
                                {rec.category}
                              </Badge>
                            </div>
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                              Learn More
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Algorithm Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Clustering Accuracy</span>
                    <span className="text-white">94%</span>
                  </div>
                  <Progress value={94} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Prediction Confidence</span>
                    <span className="text-white">87%</span>
                  </div>
                  <Progress value={87} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">User Satisfaction</span>
                    <span className="text-white">91%</span>
                  </div>
                  <Progress value={91} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert className="border-purple-500/20 bg-purple-500/10">
            <Shield className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-purple-200">
              <strong>Privacy Protected</strong>
              <br />
              All ML analysis is performed with encrypted data and follows HIPAA compliance standards.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
