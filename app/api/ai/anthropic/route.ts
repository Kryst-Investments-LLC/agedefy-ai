import { NextRequest } from 'next/server';
import { getAIConfig } from '@/lib/config/ai-config';
import { createAIRouteHandler, AIProvider } from '@/lib/utils/ai-route-handler';

const createAnthropicProvider = (): AIProvider => {
  const config = getAIConfig();
  
  return {
    name: 'Anthropic',
    enabled: config.providers.anthropic.enabled,
    apiKey: config.providers.anthropic.apiKey,
    model: config.providers.anthropic.model,
    endpoint: 'https://api.anthropic.com/v1/messages',
    headers: {
      'Authorization': `Bearer ${config.providers.anthropic.apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    requestBody: (prompt: string, maxResults: number) => ({
      model: config.providers.anthropic.model,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      system: 'You are an expert in longevity science, anti-aging research, and personalized health optimization. Provide accurate, evidence-based information and recommendations.'
    }),
    extractContent: (data: any) => data.content?.[0]?.text || 'No response generated',
    calculateCost: (data: any) => {
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      return (inputTokens * 0.000003) + (outputTokens * 0.000015);
    }
  };
};

export const POST = createAIRouteHandler(createAnthropicProvider());
