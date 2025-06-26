import { NextResponse } from 'next/server'

export function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected',
      ai_providers: {
        openai: Boolean(process.env.OPENAI_API_KEY) ? 'configured' : 'missing',
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY) ? 'configured' : 'missing',
        grok: Boolean(process.env.GROK_API_KEY) ? 'configured' : 'missing'
      }
    }
  }

  return NextResponse.json(healthCheck, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}
