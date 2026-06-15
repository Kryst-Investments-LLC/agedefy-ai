'use client'

import React, { useState } from 'react'
import { Loader2, Sparkles, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PromptDiscoveryProps {
  tier: 'explorer' | 'pro' | 'enterprise'
  onDiscovered: () => void
}

export function PromptDiscovery({
  tier,
  onDiscovered,
}: PromptDiscoveryProps) {
  const [prompt, setPrompt] = useState('')
  const [includeSimulation, setIncludeSimulation] = useState(true)
  const [includeVirtualTwin, setIncludeVirtualTwin] = useState(tier === 'enterprise')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canUseVirtualTwin = tier === 'enterprise'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!prompt.trim()) {
      setError('Please enter a discovery prompt')
      return
    }

    if (prompt.trim().length < 20) {
      setError('Prompt must be at least 20 characters')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/aeonforge/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          discoveryTier: tier,
          includeSimulation,
          includeVirtualTwin: includeVirtualTwin && canUseVirtualTwin,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Discovery failed')
      }

      // Trigger parent refresh
      onDiscovered()

      // Clear form
      setPrompt('')
      setIncludeSimulation(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process discovery prompt')
    } finally {
      setLoading(false)
    }
  }

  const examplePrompts = [
    'Novel senolytic compounds targeting p16 in cardiac aging',
    'Neoantigen vaccines for personalized cancer immunotherapy',
    'Multi-target MTH1 inhibitors for genomic instability reversal',
    'NAD+ boosting strategies for mitochondrial dysfunction',
    'Telomerase activation pathways in stem cell regeneration',
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Hypothesis Explorer
        </h2>

        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-100 text-xs">
            <strong>AI-generated hypotheses only.</strong> All candidates, scores, and numeric outputs are exploratory and have not been validated preclinically or clinically. No output represents a measured or confirmed finding. Candidates require lab confirmation before becoming hits. Not medical advice.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prompt textarea */}
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              Research Prompt
            </label>
            <Textarea
              id="prompt"
              placeholder="Describe your longevity research question. Be specific about target pathways, mechanisms, or desired outcomes..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              className="min-h-[200px] resize-none"
            />
            <p className="text-xs text-gray-500">
              {prompt.length}/5000 characters
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeSimulation}
                onChange={(e) => setIncludeSimulation(e.target.checked)}
                disabled={loading}
                className="rounded"
              />
              <span>Include AI-generated exploratory simulations</span>
            </label>

            {canUseVirtualTwin && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeVirtualTwin}
                  onChange={(e) => setIncludeVirtualTwin(e.target.checked)}
                  disabled={loading}
                  className="rounded"
                />
                <span>Generate AI hallmark response model (exploratory only)</span>
              </label>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Generating hypotheses...' : 'Generate AI Hypotheses'}
          </Button>
        </form>

        {/* Error alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Quick examples */}
        <div className="pt-4 border-t border-gray-200 dark:border-slate-800 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Example prompts:
          </p>
          <div className="space-y-1">
            {examplePrompts.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(example)}
                disabled={loading}
                className="block w-full text-left text-xs p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
