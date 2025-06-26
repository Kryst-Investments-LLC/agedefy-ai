import { getAIConfig } from '@/lib/config/ai-config';
import { createAIRouteHandler, AIProvider } from '@/lib/utils/ai-route-handler';

const createOpenAIProvider = (): AIProvider => {
  const config = getAIConfig();
  
  return {
    name: 'OpenAI',
    enabled: config.providers.openai.enabled,
    apiKey: config.providers.openai.apiKey,
    model: config.providers.openai.model,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${config.providers.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    requestBody: (prompt: string, _maxResults: number) => ({
      model: config.providers.openai.model,
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

export const POST = createAIRouteHandler(createOpenAIProvider());
