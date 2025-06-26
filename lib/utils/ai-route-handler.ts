import { NextRequest, NextResponse } from 'next/server';

import { getAIConfig } from '@/lib/config/ai-config';
import { rateLimiter, getClientIdentifier, sanitizeInput } from '@/lib/middleware/security';
import { validateAIRequest } from '@/lib/schemas/api-schemas';
import { createErrorResponse, handleAPIError, createValidationErrorResponse } from '@/lib/utils/error-handling';

export interface AIProvider {
  name: string;
  enabled: boolean;
  apiKey?: string | undefined;
  model: string;
  endpoint: string;
  headers: Record<string, string>;
  requestBody: (prompt: string, maxResults: number) => Record<string, unknown>;
  extractContent: (data: unknown) => string;
  calculateCost: (data: unknown) => number;
}

export const createAIRouteHandler = (provider: AIProvider) => {
  return async (request: NextRequest) => {
    try {
      const clientId = getClientIdentifier(request);
      if (rateLimiter.isRateLimited(clientId)) {
        return createErrorResponse('Rate limit exceeded', 429, 'RATE_LIMIT');
      }

      const config = getAIConfig();
      
      if (!provider.enabled) {
        return createErrorResponse(`${provider.name} is not enabled`, 400, 'PROVIDER_DISABLED');
      }

      if (!provider.apiKey) {
        return createErrorResponse(`${provider.name} API key not configured`, 500, 'API_KEY_MISSING');
      }

      const body = await request.json();
      const validation = validateAIRequest(body);
      
      if (!validation.success) {
        const errors = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return createValidationErrorResponse(errors);
      }

      const { query, context, maxResults } = validation.data;
      const sanitizedQuery = sanitizeInput(query);
      const sanitizedContext = context ? sanitizeInput(context) : undefined;

      const prompt = sanitizedContext 
        ? `Context: ${sanitizedContext}\n\nQuery: ${sanitizedQuery}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`
        : `Query: ${sanitizedQuery}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`;

      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(provider.requestBody(prompt, maxResults)),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // eslint-disable-next-line no-console
        console.error(`${provider.name} API error:`, error);
        return createErrorResponse(
          `${provider.name} API request failed`,
          response.status,
          'PROVIDER_API_ERROR'
        );
      }

      const data = await response.json();
      const content = provider.extractContent(data);
      const cost = provider.calculateCost(data);

      return NextResponse.json({
        content,
        provider: provider.name,
        model: provider.model,
        cost: Math.round(cost * 100) / 100,
        usage: data.usage,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      return handleAPIError(error, `${provider.name} route`);
    }
  };
};
