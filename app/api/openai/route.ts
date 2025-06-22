import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig } from '@/lib/config/ai-config';

export async function POST(request: NextRequest) {
  try {
    const config = getAIConfig();
    
    if (!config.providers.openai.enabled) {
      return NextResponse.json(
        { error: 'OpenAI is not enabled' },
        { status: 400 }
      );
    }

    if (!config.providers.openai.apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const { query, context, maxResults = 1 } = await request.json();

    const prompt = context 
      ? `Context: ${context}\n\nQuery: ${query}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`
      : `Query: ${query}\n\nPlease provide a comprehensive, scientifically accurate response focused on longevity and anti-aging research.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.providers.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        n: maxResults,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'OpenAI API request failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'No response generated';
    
    // Calculate approximate cost (GPT-4 Turbo pricing)
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = (inputTokens * 0.00001) + (outputTokens * 0.00003); // Approximate cost in USD

    return NextResponse.json({
      content,
      provider: 'OpenAI',
      model: config.providers.openai.model,
      cost: Math.round(cost * 100) / 100, // Round to 2 decimal places
      usage: data.usage,
    });

  } catch (error) {
    console.error('OpenAI route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 