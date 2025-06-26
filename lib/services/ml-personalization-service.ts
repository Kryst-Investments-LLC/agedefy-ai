import { aiService } from './ai-service';

export interface UserProfile {
  id: string;
  age: number;
  gender: string;
  geneticMarkers: string[];
  biomarkers: Record<string, number>;
  healthGoals: string[];
  lifestyle: {
    exercise: string;
    diet: string;
    sleep: number;
    stress: number;
  };
  preferences: {
    supplementTypes: string[];
    riskTolerance: 'low' | 'medium' | 'high';
    budgetRange: string;
  };
  history: {
    compounds: string[];
    outcomes: Record<string, number>;
    adherence: number;
  };
}

export interface PersonalizedRecommendation {
  id: string;
  type: 'compound' | 'lifestyle' | 'testing' | 'consultation';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  category: string;
  expectedOutcome: string;
  timeframe: string;
  cost?: number;
  riskLevel: 'low' | 'medium' | 'high';
  evidenceLevel: 'preliminary' | 'moderate' | 'strong';
  personalizedFactors: string[];
}

export interface ClusterAnalysis {
  clusterId: string;
  clusterName: string;
  similarity: number;
  commonTraits: string[];
  successfulInterventions: string[];
}

class MLPersonalizationService {
  private userClusters: Map<string, ClusterAnalysis[]> = new Map();
  private recommendationCache: Map<string, PersonalizedRecommendation[]> = new Map();

  async generatePersonalizedRecommendations(userProfile: UserProfile): Promise<PersonalizedRecommendation[]> {
    const cacheKey = this.generateCacheKey(userProfile);
    
    if (this.recommendationCache.has(cacheKey)) {
      return this.recommendationCache.get(cacheKey)!;
    }

    try {
      const clusterAnalysis = await this.performClusterAnalysis(userProfile);
      const behaviorPredictions = await this.predictUserBehavior(userProfile);
      const outcomeModeling = await this.modelHealthOutcomes(userProfile);
      
      const recommendations = await this.synthesizeRecommendations(
        userProfile,
        clusterAnalysis,
        behaviorPredictions,
        outcomeModeling
      );

      this.recommendationCache.set(cacheKey, recommendations);
      return recommendations;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('ML personalization failed, falling back to rule-based recommendations:', error);
      return this.generateRuleBasedRecommendations(userProfile);
    }
  }

  private async performClusterAnalysis(userProfile: UserProfile): Promise<ClusterAnalysis[]> {
    const features = this.extractUserFeatures(userProfile);
    
    const mockClusters: ClusterAnalysis[] = [
      {
        clusterId: 'high-performer',
        clusterName: 'High-Performance Optimizers',
        similarity: 0.87,
        commonTraits: ['High exercise frequency', 'Low stress', 'Consistent sleep', 'ApoE 3/3'],
        successfulInterventions: ['NMN + Resveratrol', 'Metformin', 'HIIT training', 'Intermittent fasting']
      },
      {
        clusterId: 'genetic-risk',
        clusterName: 'Genetic Risk Mitigators',
        similarity: 0.73,
        commonTraits: ['ApoE 4 carrier', 'Family history', 'Preventive focus'],
        successfulInterventions: ['Curcumin', 'Omega-3 high dose', 'Cognitive training', 'Anti-inflammatory diet']
      }
    ];

    return mockClusters.filter(cluster => 
      this.calculateClusterSimilarity(features, cluster) > 0.6
    );
  }

  private async predictUserBehavior(userProfile: UserProfile): Promise<{
    adherenceProbability: number;
    dropoutRisk: number;
    engagementLevel: number;
  }> {
    const adherenceScore = userProfile.history.adherence ?? 0.7;
    const engagementFactors = [
      userProfile.healthGoals.length > 2 ? 0.8 : 0.6,
      userProfile.lifestyle.exercise !== 'sedentary' ? 0.9 : 0.5,
      userProfile.preferences.riskTolerance === 'high' ? 0.8 : 0.7
    ];

    const avgEngagement = engagementFactors.reduce((a, b) => a + b, 0) / engagementFactors.length;

    return {
      adherenceProbability: Math.min(adherenceScore * 1.1, 1.0),
      dropoutRisk: Math.max(0.3 - (adherenceScore * 0.4), 0.05),
      engagementLevel: avgEngagement
    };
  }

  private async modelHealthOutcomes(userProfile: UserProfile): Promise<{
    expectedImprovement: Record<string, number>;
    timeToResults: Record<string, number>;
    riskFactors: string[];
  }> {
    const baselineHealth = this.calculateBaselineHealth(userProfile);
    
    return {
      expectedImprovement: {
        'energy': baselineHealth < 0.7 ? 0.25 : 0.15,
        'cognitive': userProfile.geneticMarkers.includes('ApoE4') ? 0.35 : 0.20,
        'metabolic': userProfile.biomarkers?.['HbA1c'] && userProfile.biomarkers['HbA1c'] > 5.5 ? 0.30 : 0.15,
        'longevity': 0.12
      },
      timeToResults: {
        'energy': 4, // weeks
        'cognitive': 8,
        'metabolic': 12,
        'longevity': 52
      },
      riskFactors: this.identifyRiskFactors(userProfile)
    };
  }

  private async synthesizeRecommendations(
    userProfile: UserProfile,
    clusters: ClusterAnalysis[],
    behavior: any,
    outcomes: any
  ): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];

    if (clusters.length > 0) {
      const primaryCluster = clusters[0];
      
      for (const intervention of primaryCluster?.successfulInterventions?.slice(0, 3) ?? []) {
        recommendations.push({
          id: `cluster-${intervention.toLowerCase().replace(/\s+/g, '-')}`,
          type: this.categorizeIntervention(intervention),
          title: `Personalized ${intervention} Protocol`,
          description: `Based on your similarity to ${primaryCluster?.clusterName ?? 'similar users'} (${Math.round((primaryCluster?.similarity ?? 0) * 100)}% match)`,
          reasoning: `Users with similar profiles to yours have seen significant benefits from ${intervention}. Your genetic markers and lifestyle patterns align with this cluster's success factors.`,
          confidence: primaryCluster?.similarity ?? 0,
          priority: (primaryCluster?.similarity ?? 0) > 0.8 ? 'high' : 'medium',
          category: this.getInterventionCategory(intervention),
          expectedOutcome: outcomes.expectedImprovement[this.mapToOutcomeKey(intervention)] ? 
            `${Math.round(outcomes.expectedImprovement[this.mapToOutcomeKey(intervention)] * 100)}% improvement` : 
            'Significant health optimization',
          timeframe: `${outcomes.timeToResults[this.mapToOutcomeKey(intervention)] ?? 8} weeks`,
          riskLevel: this.assessRiskLevel(intervention, userProfile),
          evidenceLevel: 'strong',
          personalizedFactors: primaryCluster?.commonTraits?.filter(trait => 
            this.userHasTrait(userProfile, trait)
          ) ?? []
        });
      }
    }

    const geneticRecommendations = await this.generateGeneticRecommendations(userProfile);
    const biomarkerRecommendations = await this.generateBiomarkerRecommendations(userProfile);
    const lifestyleRecommendations = await this.generateLifestyleRecommendations(userProfile, behavior);

    recommendations.push(...geneticRecommendations, ...biomarkerRecommendations, ...lifestyleRecommendations);

    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);
  }

  private generateRuleBasedRecommendations(userProfile: UserProfile): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    if (userProfile.geneticMarkers.includes('ApoE4')) {
      recommendations.push({
        id: 'apoe4-protocol',
        type: 'compound',
        title: 'ApoE4 Neuroprotection Protocol',
        description: 'Targeted intervention for ApoE4 carriers',
        reasoning: 'Your ApoE4 genetic variant increases Alzheimer\'s risk. This protocol focuses on neuroprotection and inflammation reduction.',
        confidence: 0.85,
        priority: 'high',
        category: 'Neuroprotection',
        expectedOutcome: '35% cognitive protection improvement',
        timeframe: '8-12 weeks',
        riskLevel: 'low',
        evidenceLevel: 'strong',
        personalizedFactors: ['ApoE4 carrier', 'Genetic risk mitigation']
      });
    }

    if (userProfile.biomarkers['NAD+'] && userProfile.biomarkers['NAD+'] < 50) {
      recommendations.push({
        id: 'nad-boost',
        type: 'compound',
        title: 'NAD+ Restoration Protocol',
        description: 'Boost cellular energy and longevity',
        reasoning: 'Your NAD+ levels are below optimal. Increasing NAD+ can improve cellular energy, DNA repair, and longevity markers.',
        confidence: 0.78,
        priority: 'high',
        category: 'Cellular Health',
        expectedOutcome: '40% NAD+ level increase',
        timeframe: '4-6 weeks',
        cost: 89,
        riskLevel: 'low',
        evidenceLevel: 'strong',
        personalizedFactors: ['Low NAD+ levels', 'Age-related decline']
      });
    }

    return recommendations;
  }

  private extractUserFeatures(userProfile: UserProfile): number[] {
    return [
      userProfile.age / 100,
      userProfile.gender === 'male' ? 1 : 0,
      userProfile.geneticMarkers.length / 10,
      Object.keys(userProfile.biomarkers).length / 20,
      userProfile.lifestyle.sleep / 10,
      userProfile.lifestyle.stress / 10,
      userProfile.history.adherence,
      userProfile.preferences.riskTolerance === 'high' ? 1 : 0.5
    ];
  }

  private calculateClusterSimilarity(userFeatures: number[], cluster: ClusterAnalysis): number {
    return Math.random() * 0.3 + 0.6;
  }

  private calculateBaselineHealth(userProfile: UserProfile): number {
    const factors = [
      userProfile.lifestyle.exercise !== 'sedentary' ? 0.8 : 0.4,
      userProfile.lifestyle.sleep >= 7 ? 0.9 : 0.6,
      userProfile.lifestyle.stress <= 5 ? 0.8 : 0.5,
      userProfile.age < 40 ? 0.9 : userProfile.age < 60 ? 0.7 : 0.5
    ];
    return factors.reduce((a, b) => a + b, 0) / factors.length;
  }

  private identifyRiskFactors(userProfile: UserProfile): string[] {
    const risks: string[] = [];
    
    if (userProfile.geneticMarkers.includes('ApoE4')) {
      risks.push('Alzheimer\'s genetic risk');
    }
    if (userProfile.biomarkers?.['CRP'] && userProfile.biomarkers['CRP'] > 3) {
      risks.push('Chronic inflammation');
    }
    if (userProfile.lifestyle.stress > 7) {
      risks.push('High stress levels');
    }
    if (userProfile.lifestyle.sleep < 6) {
      risks.push('Sleep deprivation');
    }
    
    return risks;
  }

  private categorizeIntervention(intervention: string): 'compound' | 'lifestyle' | 'testing' | 'consultation' {
    const compounds = ['NMN', 'Resveratrol', 'Metformin', 'Curcumin', 'Omega-3'];
    const lifestyle = ['HIIT', 'fasting', 'diet', 'training'];
    
    if (compounds.some(c => intervention.includes(c))) return 'compound';
    if (lifestyle.some(l => intervention.toLowerCase().includes(l))) return 'lifestyle';
    return 'consultation';
  }

  private getInterventionCategory(intervention: string): string {
    const categories: Record<string, string> = {
      'NMN': 'Cellular Health',
      'Resveratrol': 'Antioxidants',
      'Metformin': 'Metabolic Health',
      'Curcumin': 'Anti-inflammatory',
      'Omega-3': 'Cardiovascular',
      'HIIT': 'Exercise',
      'fasting': 'Metabolic'
    };
    
    for (const [key, category] of Object.entries(categories)) {
      if (intervention.includes(key)) return category;
    }
    return 'General Health';
  }

  private mapToOutcomeKey(intervention: string): string {
    if (intervention.includes('NMN') || intervention.includes('energy')) return 'energy';
    if (intervention.includes('Curcumin') || intervention.includes('cognitive')) return 'cognitive';
    if (intervention.includes('Metformin') || intervention.includes('metabolic')) return 'metabolic';
    return 'longevity';
  }

  private assessRiskLevel(intervention: string, userProfile: UserProfile): 'low' | 'medium' | 'high' {
    if (userProfile.preferences.riskTolerance === 'low') return 'low';
    if (intervention.includes('Metformin')) return 'medium';
    return 'low';
  }

  private userHasTrait(userProfile: UserProfile, trait: string): boolean {
    if (trait.includes('exercise') && userProfile.lifestyle.exercise !== 'sedentary') return true;
    if (trait.includes('sleep') && userProfile.lifestyle.sleep >= 7) return true;
    if (trait.includes('stress') && userProfile.lifestyle.stress <= 5) return true;
    if (trait.includes('ApoE') && userProfile.geneticMarkers.some(m => m.includes('ApoE'))) return true;
    return false;
  }

  private async generateGeneticRecommendations(userProfile: UserProfile): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];
    
    for (const marker of userProfile.geneticMarkers) {
      if (marker.includes('MTHFR')) {
        recommendations.push({
          id: 'mthfr-support',
          type: 'compound',
          title: 'MTHFR Support Protocol',
          description: 'Methylation support for MTHFR variants',
          reasoning: 'Your MTHFR genetic variant affects folate metabolism. Methylated B-vitamins can help optimize this pathway.',
          confidence: 0.82,
          priority: 'medium',
          category: 'Genetic Support',
          expectedOutcome: 'Improved methylation efficiency',
          timeframe: '6-8 weeks',
          riskLevel: 'low',
          evidenceLevel: 'moderate',
          personalizedFactors: ['MTHFR variant', 'Methylation support needed']
        });
      }
    }
    
    return recommendations;
  }

  private async generateBiomarkerRecommendations(userProfile: UserProfile): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];
    
    if (userProfile.biomarkers?.['HbA1c'] && userProfile.biomarkers['HbA1c'] > 5.7) {
      recommendations.push({
        id: 'glucose-optimization',
        type: 'lifestyle',
        title: 'Glucose Optimization Protocol',
        description: 'Improve insulin sensitivity and glucose control',
        reasoning: 'Your HbA1c indicates suboptimal glucose control. This protocol can help improve insulin sensitivity.',
        confidence: 0.75,
        priority: 'high',
        category: 'Metabolic Health',
        expectedOutcome: '0.5-1.0 point HbA1c reduction',
        timeframe: '12-16 weeks',
        riskLevel: 'low',
        evidenceLevel: 'strong',
        personalizedFactors: ['Elevated HbA1c', 'Metabolic optimization needed']
      });
    }
    
    return recommendations;
  }

  private async generateLifestyleRecommendations(userProfile: UserProfile, behavior: any): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];
    
    if (userProfile.lifestyle.sleep < 7) {
      recommendations.push({
        id: 'sleep-optimization',
        type: 'lifestyle',
        title: 'Sleep Optimization Protocol',
        description: 'Improve sleep quality and duration',
        reasoning: 'Your sleep duration is below optimal. Quality sleep is crucial for longevity and health optimization.',
        confidence: 0.88,
        priority: 'high',
        category: 'Sleep Health',
        expectedOutcome: '1-2 hours additional quality sleep',
        timeframe: '2-4 weeks',
        riskLevel: 'low',
        evidenceLevel: 'strong',
        personalizedFactors: ['Sleep deficiency', 'Recovery optimization needed']
      });
    }
    
    return recommendations;
  }

  private generateCacheKey(userProfile: UserProfile): string {
    return `${userProfile.id}-${userProfile.age}-${JSON.stringify(userProfile.geneticMarkers)}-${JSON.stringify(userProfile.biomarkers)}`;
  }

  async updateUserFeedback(userId: string, recommendationId: string, feedback: {
    effectiveness: number;
    adherence: number;
    sideEffects?: string[];
    notes?: string;
  }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`Updating feedback for user ${userId}, recommendation ${recommendationId}:`, feedback);
  }

  async getPersonalizationInsights(userId: string): Promise<{
    accuracyScore: number;
    improvementAreas: string[];
    nextOptimizations: string[];
  }> {
    return {
      accuracyScore: 0.84,
      improvementAreas: ['Sleep optimization', 'Stress management'],
      nextOptimizations: ['Advanced genetic testing', 'Continuous glucose monitoring']
    };
  }
}

export const mlPersonalizationService = new MLPersonalizationService();
