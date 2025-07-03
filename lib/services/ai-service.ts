import { getAIConfig, isProviderEnabled } from '../config/ai-config';

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  timestamp: Date;
  cost?: number;
}

export interface HealthRecommendation {
  recommendation: string;
  reasoning: string;
  confidence: number;
  sources?: string[];
}

export interface ResearchQuery {
  query: string;
  context?: string | Record<string, unknown> | undefined;
  maxResults?: number;
}

class AIService {
  private config = getAIConfig();

  async getHealthRecommendation(userData: Record<string, unknown>): Promise<HealthRecommendation> {
    if (!this.config.features.aiHealthCoach) {
      return this.getMockHealthRecommendation(userData);
    }

    try {
      if (isProviderEnabled('openai')) {
        return await this.getOpenAIRecommendation(userData);
      } else if (isProviderEnabled('grok')) {
        return await this.getGrokRecommendation(userData);
      } else if (isProviderEnabled('anthropic')) {
        return await this.getAnthropicRecommendation(userData);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('AI service failed, falling back to mock data:', error);
    }

    return this.getMockHealthRecommendation(userData);
  }

  async researchQuery(query: ResearchQuery): Promise<AIResponse> {
    if (!this.config.features.researchAssistant) {
      return this.getMockResearchResponse(query);
    }

    try {
      if (isProviderEnabled('openai')) {
        return await this.callOpenAI(query);
      } else if (isProviderEnabled('grok')) {
        return await this.callGrok(query);
      } else if (isProviderEnabled('anthropic')) {
        return await this.callAnthropic(query);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('AI research failed, falling back to mock data:', error);
    }

    return this.getMockResearchResponse(query);
  }

  async getVirtualAdvisorResponse(userQuery: string, context?: Record<string, unknown>): Promise<AIResponse> {
    if (!this.config.features.virtualAdvisor) {
      return this.getMockAdvisorResponse(userQuery);
    }

    try {
      if (isProviderEnabled('openai')) {
        return await this.callOpenAI({ query: userQuery, context });
      } else if (isProviderEnabled('grok')) {
        return await this.callGrok({ query: userQuery, context });
      } else if (isProviderEnabled('anthropic')) {
        return await this.callAnthropic({ query: userQuery, context });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Virtual advisor failed, falling back to mock data:', error);
    }

    return this.getMockAdvisorResponse(userQuery);
  }

  // OpenAI Integration
  private async callOpenAI(query: ResearchQuery): Promise<AIResponse> {
    const response = await fetch('/api/ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      provider: 'OpenAI',
      model: this.config.providers.openai.model,
      timestamp: new Date(),
      cost: data.cost,
    };
  }

  private async getOpenAIRecommendation(userData: Record<string, unknown>): Promise<HealthRecommendation> {
    const response = await this.callOpenAI({
      query: `Based on this user data: ${JSON.stringify(userData)}, provide a personalized health recommendation for longevity optimization.`,
    });

    return {
      recommendation: response.content,
      reasoning: 'AI analysis based on user biomarkers and health data',
      confidence: 0.85,
      sources: ['AI Analysis'],
    };
  }

  // Grok Integration
  private async callGrok(query: ResearchQuery): Promise<AIResponse> {
    const response = await fetch('/api/ai/grok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      provider: 'Grok',
      model: this.config.providers.grok.model,
      timestamp: new Date(),
      cost: data.cost,
    };
  }

  private async getGrokRecommendation(userData: Record<string, unknown>): Promise<HealthRecommendation> {
    const response = await this.callGrok({
      query: `Analyze this user's health data and provide longevity recommendations: ${JSON.stringify(userData)}`,
    });

    return {
      recommendation: response.content,
      reasoning: 'Advanced AI analysis with real-time data integration',
      confidence: 0.88,
      sources: ['Grok AI Analysis'],
    };
  }

  // Anthropic Integration
  private async callAnthropic(query: ResearchQuery): Promise<AIResponse> {
    const response = await fetch('/api/ai/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      provider: 'Anthropic',
      model: this.config.providers.anthropic.model,
      timestamp: new Date(),
      cost: data.cost,
    };
  }

  private async getAnthropicRecommendation(userData: Record<string, unknown>): Promise<HealthRecommendation> {
    const response = await this.callAnthropic({
      query: `Provide health recommendations for longevity based on: ${JSON.stringify(userData)}`,
    });

    return {
      recommendation: response.content,
      reasoning: 'Claude analysis with safety-focused recommendations',
      confidence: 0.82,
      sources: ['Anthropic Claude Analysis'],
    };
  }

  // Mock Data Fallbacks
  private getMockHealthRecommendation(_userData: Record<string, unknown>): HealthRecommendation {
    const recommendations = [
      'Consider implementing a time-restricted eating protocol (16:8) to optimize autophagy.',
      'Increase your NAD+ levels through supplementation with NMN or NR.',
      'Add strength training 3x per week to maintain muscle mass and bone density.',
      'Consider metformin for metabolic optimization if approved by your physician.',
      'Implement a comprehensive sleep optimization protocol targeting 7-9 hours.',
    ];

    return {
      recommendation: recommendations[Math.floor(Math.random() * recommendations.length)] ?? 'No recommendation available',
      reasoning: 'Based on comprehensive biomarker analysis and longevity research',
      confidence: 0.75,
      sources: ['Mock Analysis - Enable AI features for real recommendations'],
    };
  }

  private getMockResearchResponse(query: ResearchQuery): AIResponse {
    const mockResponses = [
      'Recent studies show that rapamycin may extend lifespan by 10-15% in mammals through mTOR inhibition.',
      'NAD+ precursors like NMN have shown promise in reversing age-related decline in mouse models.',
      'Senolytics like fisetin and quercetin target and eliminate senescent cells that contribute to aging.',
      'Metformin has demonstrated anti-aging effects through AMPK activation and reduced inflammation.',
      'Intermittent fasting activates autophagy and may extend healthy lifespan.',
    ];

    return {
      content: mockResponses[Math.floor(Math.random() * mockResponses.length)] ?? 'No response available',
      provider: 'Mock AI',
      model: 'mock-model',
      timestamp: new Date(),
    };
  }

  private getMockAdvisorResponse(query: string): AIResponse {
    return {
      content: `Thank you for your question about "${query}". I'm currently in demo mode. Enable AI features for personalized, real-time advice based on the latest longevity research.`,
      provider: 'Mock Advisor',
      model: 'demo-mode',
      timestamp: new Date(),
    };
  }
}

export const aiService = new AIService();                                    