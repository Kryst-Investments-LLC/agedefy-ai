/**
 * Dynamic OG Image Generation
 *
 * Generates Open Graph images for social sharing using @vercel/og ImageResponse.
 * Templates: bio-age score card, achievement unlock, protocol milestone, compound insight.
 *
 * @module app/api/og/route
 */

import { ImageResponse } from 'next/og'
import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/* ------------------------------------------------------------------ */
/*  Template renderers                                                */
/* ------------------------------------------------------------------ */

function BioAgeCard({ bioAge, chronoAge }: { bioAge: string; chronoAge: string }) {
  const diff = parseFloat(chronoAge) - parseFloat(bioAge)
  const diffLabel = diff >= 0 ? `${diff.toFixed(1)} years younger` : `${Math.abs(diff).toFixed(1)} years older`
  const diffColor = diff >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: '60px',
      }}
    >
      <div style={{ display: 'flex', fontSize: '28px', color: '#94a3b8', marginBottom: '16px' }}>
        Biozephyra — Bio-Age Score
      </div>
      <div style={{ display: 'flex', fontSize: '96px', fontWeight: 'bold', marginBottom: '8px' }}>
        {bioAge}
      </div>
      <div style={{ display: 'flex', fontSize: '24px', color: '#94a3b8', marginBottom: '24px' }}>
        Biological Age (Chronological: {chronoAge})
      </div>
      <div style={{ display: 'flex', fontSize: '32px', fontWeight: 'bold', color: diffColor }}>
        {diffLabel}
      </div>
    </div>
  )
}

function AchievementCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: '60px',
      }}
    >
      <div style={{ display: 'flex', fontSize: '28px', color: '#fbbf24', marginBottom: '20px' }}>
        🏆 Achievement Unlocked
      </div>
      <div style={{ display: 'flex', fontSize: '64px', marginBottom: '16px' }}>
        {icon === 'trophy' ? '🏆' : icon === 'flame' ? '🔥' : icon === 'star' ? '⭐' : '🎯'}
      </div>
      <div style={{ display: 'flex', fontSize: '48px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: '24px', color: '#94a3b8', textAlign: 'center' }}>
        {description}
      </div>
      <div style={{ display: 'flex', fontSize: '20px', color: '#64748b', marginTop: '24px' }}>
        Biozephyra
      </div>
    </div>
  )
}

function ProtocolCard({ name, status }: { name: string; status: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: '60px',
      }}
    >
      <div style={{ display: 'flex', fontSize: '28px', color: '#38bdf8', marginBottom: '24px' }}>
        Biozephyra — Protocol
      </div>
      <div style={{ display: 'flex', fontSize: '48px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
        {name}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: '24px',
          background: status === 'completed' ? '#22c55e' : '#3b82f6',
          padding: '8px 24px',
          borderRadius: '12px',
        }}
      >
        {status === 'completed' ? '✅ Completed' : '🔬 In Progress'}
      </div>
    </div>
  )
}

function InsightCard({ title, value, sampleSize }: { title: string; value: string; sampleSize: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #18181b 0%, #1e1b4b 100%)',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: '60px',
      }}
    >
      <div style={{ display: 'flex', fontSize: '28px', color: '#a78bfa', marginBottom: '24px' }}>
        Biozephyra — Population Insight
      </div>
      <div style={{ display: 'flex', fontSize: '40px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: '72px', fontWeight: 'bold', color: '#22c55e', marginBottom: '16px' }}>
        {value}
      </div>
      <div style={{ display: 'flex', fontSize: '20px', color: '#64748b' }}>
        n={sampleSize} participants
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Route Handler                                                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const template = searchParams.get('template') ?? 'bio-age'

  try {
    let element: React.ReactElement

    switch (template) {
      case 'bio-age':
        element = (
          <BioAgeCard
            bioAge={searchParams.get('bioAge') ?? '35.2'}
            chronoAge={searchParams.get('chronoAge') ?? '42.0'}
          />
        )
        break

      case 'achievement':
        element = (
          <AchievementCard
            title={searchParams.get('title') ?? 'Achievement Unlocked'}
            description={searchParams.get('description') ?? 'Congratulations on your milestone!'}
            icon={searchParams.get('icon') ?? 'trophy'}
          />
        )
        break

      case 'protocol':
        element = (
          <ProtocolCard
            name={searchParams.get('name') ?? 'Protocol'}
            status={searchParams.get('status') ?? 'active'}
          />
        )
        break

      case 'insight':
        element = (
          <InsightCard
            title={searchParams.get('title') ?? 'Population Insight'}
            value={searchParams.get('value') ?? '+12%'}
            sampleSize={searchParams.get('sampleSize') ?? '47'}
          />
        )
        break

      default:
        return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
    }

    return new ImageResponse(element, {
      width: 1200,
      height: 630,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
