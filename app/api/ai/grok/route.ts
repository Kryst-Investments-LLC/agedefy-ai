import { getAIConfig } from '@/lib/config/ai-config';
import { createAIRouteHandler, AIProvider } from '@/lib/utils/ai-route-handler';

const createGrokProvider = (): AIProvider => {
  const config = getAIConfig();
  
  return {
    name: 'Grok',
    enabled: config.providers.grok.enabled,
    apiKey: config.providers.grok.apiKey,
    model: config.providers.grok.model,
    endpoint: 'https://api.x.ai/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${config.providers.grok.apiKey}`,
      'Content-Type': 'application/json',
    },
    requestBody: (prompt: string, _maxResults: number) => ({
      model: config.providers.grok.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert in longevity science, anti-aging research, and personalized health optimization. Provide accurate, evidence-based information and recommendations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      n: 1,
    }),
    extractContent: (data: unknown) => {
      const response = data as { choices?: Array<{ message?: { content?: string } }> }
      return response.choices?.[0]?.message?.content ?? 'No response generated'
    },
    calculateCost: (data: unknown) => {
      const response = data as { usage?: { prompt_tokens?: number; completion_tokens?: number } }
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      return (inputTokens * 0.00001) + (outputTokens * 0.00003);
    }
  };
};

export const POST = createAIRouteHandler(createGrokProvider());
