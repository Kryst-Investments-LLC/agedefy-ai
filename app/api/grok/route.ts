import { NextRequest, NextResponse } from 'next/server';

import { getAIConfig } from '@/lib/config/ai-config';

export async function POST(request: NextRequest) {
  try {
    const config = getAIConfig();
    
    if (!config.providers.grok.enabled) {
      return NextResponse.json(
        { error: 'Grok is not enabled' },
        { status: 400 }
      );
    }

    if (!config.providers.grok.apiKey) {
      return NextResponse.json(
        { error: 'Grok API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as { query: string; context?: string; maxResults?: number };
    const { query, context, maxResults = 1 } = body;

    const prompt = context 
      ? `Context: ${context}\n\nQuery: ${query}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`
      : `Query: ${query}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`;

    // Note: Grok API endpoint may vary based on official release
    // This is a placeholder implementation
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.providers.grok.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        n: maxResults,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      // eslint-disable-next-line no-console
      console.error('Grok API error:', error);
      return NextResponse.json(
        { error: 'Grok API request failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content ?? 'No response generated';
    
    // Calculate approximate cost (placeholder - adjust based on actual Grok pricing)
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const cost = (inputTokens * 0.00001) + (outputTokens * 0.00003); // Approximate cost in USD

    return NextResponse.json({
      content,
      provider: 'Grok',
      model: config.providers.grok.model,
      cost: Math.round(cost * 100) / 100,
      usage: data.usage ?? {},
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Grok route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}        