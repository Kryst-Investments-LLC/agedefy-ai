import { NextRequest, NextResponse } from 'next/server';

import { getAIConfig } from '@/lib/config/ai-config';

export async function POST(request: NextRequest) {
  try {
    const config = getAIConfig();
    
    if (!config.providers.anthropic.enabled) {
      return NextResponse.json(
        { error: 'Anthropic is not enabled' },
        { status: 400 }
      );
    }

    const apiKey = config.providers.anthropic.apiKey;
    if (!apiKey || apiKey === '') {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as { query: string; context?: string; maxResults?: number };
    const { query, context, maxResults: _maxResults = 1 } = body;

    const prompt = context 
      ? `Context: ${context}\n\nQuery: ${query}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`
      : `Query: ${query}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
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
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string; message?: string };
      // eslint-disable-next-line no-console
      console.error('Anthropic API error:', error);
      return NextResponse.json(
        { error: 'Anthropic API request failed' },
        { status: response.status }
      );
    }

    const data = await response.json() as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = data.content?.[0]?.text ?? 'No response generated';
    
    // Calculate approximate cost (Claude 3 Sonnet pricing)
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const cost = (inputTokens * 0.000003) + (outputTokens * 0.000015); // Approximate cost in USD

    return NextResponse.json({
      content,
      provider: 'Anthropic',
      model: config.providers.anthropic.model,
      cost: Math.round(cost * 100) / 100,
      usage: data.usage ?? {},
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Anthropic route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}                          