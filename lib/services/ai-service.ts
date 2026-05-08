import { withJsonMutationHeaders } from '@/lib/client-idempotency';
import { getAIConfig, isProviderEnabled } from '../config/ai-config';

type UserHealthInput = Record<string, unknown>;

export interface AICitation {
  title: string;
  source: string;
  url?: string;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  timestamp: Date;
  cost?: number;
  disclaimer?: string;
  disclaimers?: string[];
  citations?: AICitation[];
}

export interface HealthRecommendation {
  recommendation: string;
  reasoning: string;
  confidence: number;
  sources?: string[];
}

export interface ResearchQuery {
  query: string;
  context?: string;
  maxResults?: number;
}

class AIService {
  private config = getAIConfig();

  async getHealthRecommendation(userData: UserHealthInput): Promise<HealthRecommendation> {
    this.assertFeatureEnabled("aiHealthCoach");

    try {
      if (isProviderEnabled('openai')) {
        return await this.getOpenAIRecommendation(userData);
      } else if (isProviderEnabled('grok')) {
        return await this.getGrokRecommendation(userData);
      } else if (isProviderEnabled('anthropic')) {
        return await this.getAnthropicRecommendation(userData);
      }
      throw new Error('No AI provider is enabled');
    } catch (error) {
      console.error('AI health recommendation failed:', error);
      throw error;
    }
  }

  async researchQuery(query: ResearchQuery): Promise<AIResponse> {
    this.assertFeatureEnabled("researchAssistant");

    try {
      if (isProviderEnabled('openai')) {
        return await this.callOpenAI(query);
      } else if (isProviderEnabled('grok')) {
        return await this.callGrok(query);
      } else if (isProviderEnabled('anthropic')) {
        return await this.callAnthropic(query);
      }
      throw new Error('No AI provider is enabled');
    } catch (error) {
      console.error('AI research failed:', error);
      throw error;
    }
  }

  async getVirtualAdvisorResponse(userQuery: string, context?: string): Promise<AIResponse> {
    this.assertFeatureEnabled("virtualAdvisor");

    try {
      if (isProviderEnabled('openai')) {
        return await this.callOpenAI({ query: userQuery, context });
      } else if (isProviderEnabled('grok')) {
        return await this.callGrok({ query: userQuery, context });
      } else if (isProviderEnabled('anthropic')) {
        return await this.callAnthropic({ query: userQuery, context });
      }
      throw new Error('No AI provider is enabled');
    } catch (error) {
      console.error('Virtual advisor failed:', error);
      throw error;
    }
  }

  private assertFeatureEnabled(feature: keyof ReturnType<typeof getAIConfig>["features"]) {
    if (!this.config.features[feature]) {
      throw new Error(`${feature} is not enabled`)
    }
  }

  // OpenAI Integration
  private async callOpenAI(query: ResearchQuery): Promise<AIResponse> {
    const response = await fetch('/api/ai/openai', {
      ...withJsonMutationHeaders({
        method: 'POST',
      }, 'ai-service-openai'),
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
      disclaimer: data.disclaimer,
      disclaimers: data.disclaimers,
      citations: data.citations,
    };
  }

  private async getOpenAIRecommendation(userData: UserHealthInput): Promise<HealthRecommendation> {
    const response = await this.callOpenAI({
      query: `Based on this user data: ${JSON.stringify(userData)}, provide a personalized health recommendation for longevity optimization.`,
    });

    return {
      recommendation: response.content,
      reasoning: 'AI-generated informational summary based on user biomarkers and health data.',
      confidence: 0.85,
      sources: response.citations?.map((citation) => `${citation.source}: ${citation.title}`) ?? ['Provider AI summary'],
    };
  }

  // Grok Integration
  private async callGrok(query: ResearchQuery): Promise<AIResponse> {
    const response = await fetch('/api/ai/grok', {
      ...withJsonMutationHeaders({
        method: 'POST',
      }, 'ai-service-grok'),
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
      disclaimer: data.disclaimer,
      disclaimers: data.disclaimers,
      citations: data.citations,
    };
  }

  private async getGrokRecommendation(userData: UserHealthInput): Promise<HealthRecommendation> {
    const response = await this.callGrok({
      query: `Analyze this user's health data and provide longevity recommendations: ${JSON.stringify(userData)}`,
    });

    return {
      recommendation: response.content,
      reasoning: 'AI-generated informational summary using the selected provider.',
      confidence: 0.88,
      sources: response.citations?.map((citation) => `${citation.source}: ${citation.title}`) ?? ['Provider AI summary'],
    };
  }

  // Anthropic Integration
  private async callAnthropic(query: ResearchQuery): Promise<AIResponse> {
    const response = await fetch('/api/ai/anthropic', {
      ...withJsonMutationHeaders({
        method: 'POST',
      }, 'ai-service-anthropic'),
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
      disclaimer: data.disclaimer,
      disclaimers: data.disclaimers,
      citations: data.citations,
    };
  }

  private async getAnthropicRecommendation(userData: UserHealthInput): Promise<HealthRecommendation> {
    const response = await this.callAnthropic({
      query: `Provide health recommendations for longevity based on: ${JSON.stringify(userData)}`,
    });

    return {
      recommendation: response.content,
      reasoning: 'AI-generated informational summary with safety-oriented framing.',
      confidence: 0.82,
      sources: response.citations?.map((citation) => `${citation.source}: ${citation.title}`) ?? ['Provider AI summary'],
    };
  }
}

export const aiService = new AIService(); 