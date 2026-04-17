"use client"

import { useState, FormEvent, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { withJsonMutationHeaders } from "@/lib/client-idempotency"
import { Brain, Send, Loader2, AlertTriangle, User, Bot } from "lucide-react"

interface Citation {
  title: string
  source: string
  url?: string
}

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  provider?: string
  disclaimer?: string
  disclaimers?: string[]
  citations?: Citation[]
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  "What are the most evidence-backed longevity compounds?",
  "How does mTOR inhibition extend lifespan?",
  "What biomarkers should I track for aging?",
  "Explain the difference between NMN and NR",
  "What are senolytics and how do they work?",
  "How does caloric restriction affect aging pathways?",
]

export function AIHealthCoach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "system",
      role: "system",
      content: "I'm your AI longevity science assistant. I can provide informational summaries about aging biology, compounds, biomarkers, and research questions. Verify important claims against source material and a qualified healthcare professional.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setError(null)
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      // Try OpenAI first, fall back to other providers
      const providers = ["/api/ai/openai", "/api/ai/anthropic", "/api/ai/grok"]
      let responded = false

      for (const endpoint of providers) {
        try {
          const res = await fetch(endpoint, {
            ...withJsonMutationHeaders({
              method: "POST",
            }, `ai-health-coach-${endpoint.split("/").pop() ?? "provider"}`),
            body: JSON.stringify({
              query: text.trim(),
              context: "User is asking about longevity science, health research, or optimization topics. Provide informational, evidence-aware guidance.",
            }),
          })

          if (res.ok) {
            const data = await res.json()
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.content,
                provider: data.provider,
                disclaimer: data.disclaimer,
                disclaimers: data.disclaimers,
                citations: data.citations,
                timestamp: new Date(),
              },
            ])
            responded = true
            break
          }
        } catch {
          continue
        }
      }

      if (!responded) {
        setError("No AI provider is currently available. Ensure at least one provider API key is configured in your environment.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> AI Longevity Assistant
          </CardTitle>
          <CardDescription>
            Ask questions about aging biology, compounds, biomarkers, and longevity research.
            Responses are informational and may include citations when the provider can supply them reliably.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role !== "user" && (
                  <div className="h-8 w-8 rounded-full bg-teal-600/20 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-teal-400" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-3 max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-teal-600 text-white"
                      : msg.role === "system"
                      ? "bg-gray-800 border border-gray-700"
                      : "bg-gray-800 border border-gray-700"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.provider && (
                    <Badge variant="outline" className="text-[10px] mt-2">{msg.provider}</Badge>
                  )}
                  {msg.role === "assistant" && (msg.disclaimers?.length || msg.citations?.length) ? (
                    <div className="mt-3 space-y-3">
                      {msg.disclaimers?.length ? (
                        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2 text-xs text-yellow-100">
                          {msg.disclaimers.map((item, index) => (
                            <p key={`${msg.id}-disclaimer-${index}`}>{item}</p>
                          ))}
                        </div>
                      ) : null}
                      {msg.citations?.length ? (
                        <div className="space-y-1 text-xs text-gray-300">
                          <p className="uppercase tracking-[0.16em] text-gray-500">Sources</p>
                          {msg.citations.map((citation, index) => (
                            citation.url ? (
                              <a
                                key={`${msg.id}-citation-${index}`}
                                href={citation.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-teal-300 hover:underline"
                              >
                                {citation.source}: {citation.title}
                              </a>
                            ) : (
                              <p key={`${msg.id}-citation-${index}`}>
                                {citation.source}: {citation.title}
                              </p>
                            )
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-teal-600/20 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-teal-400" />
                </div>
                <div className="rounded-lg px-4 py-3 bg-gray-800 border border-gray-700">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 mb-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Suggested questions (only if no user messages yet) */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTED_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
            <Input
              placeholder="Ask about longevity science…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        AI responses are informational only and may not be accurate. Always consult a qualified healthcare provider.
        No medical advice is provided.
      </p>
    </div>
  )
}
