import {
  providerAIResponseSchema,
  providerAIStructuredContentSchema,
  type AICitation,
  type ProviderAIResponse,
} from "@/lib/validators/ai"

const DEFAULT_PROVIDER_AI_DISCLAIMER =
  "Informational only. This response does not provide medical advice, diagnosis, or treatment recommendations."
const REVIEW_CITED_SOURCES_DISCLAIMER =
  "Review cited sources and consult a qualified clinician before acting on this information."
const NO_CITATIONS_DISCLAIMER =
  "No source citations were attached to this response. Verify against primary literature or clinician guidance before acting."

export const providerAIResponseFormatInstructions = [
  "Return valid JSON only.",
  "Use exactly this shape:",
  '{"answer":"...","disclaimer":"...","citations":[{"title":"...","source":"...","url":"https://..."}]}',
  "Keep the answer informational, concise, and evidence-aware.",
  "State uncertainty when evidence is weak or mixed.",
  "Only include citations you can identify with reasonable confidence. If unsure, return an empty citations array.",
  "Do not diagnose, prescribe, or guarantee safety or efficacy.",
].join("\n")

export const providerAILongevitySystemPrompt = [
  "You are an evidence-aware longevity research assistant.",
  "Provide informational summaries only.",
  "Do not diagnose, prescribe, or guarantee outcomes, safety, or efficacy.",
  "When evidence is uncertain or incomplete, say so plainly.",
  "Respond using the requested JSON format only.",
].join(" ")

function buildJsonCandidates(rawContent: string) {
  const trimmed = rawContent.trim()
  const candidates = new Set<string>()

  if (!trimmed) {
    return []
  }

  candidates.add(trimmed)

  const codeFenceMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)
  for (const match of codeFenceMatches) {
    const candidate = match[1]?.trim()
    if (candidate) {
      candidates.add(candidate)
    }
  }

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1))
  }

  return [...candidates]
}

function normalizeStructuredContent(rawContent: string) {
  for (const candidate of buildJsonCandidates(rawContent)) {
    try {
      const parsed = JSON.parse(candidate) as {
        answer?: unknown
        content?: unknown
        disclaimer?: unknown
        citations?: unknown
      }

      const normalized = providerAIStructuredContentSchema.safeParse({
        answer: typeof parsed.answer === "string" ? parsed.answer : parsed.content,
        disclaimer: parsed.disclaimer,
        citations: parsed.citations,
      })

      if (normalized.success) {
        return normalized.data
      }
    } catch {
      continue
    }
  }

  return null
}

function buildDisclaimers(citations: AICitation[], disclaimer?: string) {
  return [...new Set([
    disclaimer?.trim() || DEFAULT_PROVIDER_AI_DISCLAIMER,
    citations.length > 0 ? REVIEW_CITED_SOURCES_DISCLAIMER : NO_CITATIONS_DISCLAIMER,
  ])]
}

export function buildProviderAIResponseEnvelope(args: {
  rawContent: string
  provider: string
  model: string
  cost: number
  usage?: unknown
}): ProviderAIResponse {
  const structured = normalizeStructuredContent(args.rawContent)
  const content = structured?.answer?.trim() || args.rawContent.trim() || "No response generated"
  const citations = structured?.citations ?? []
  const disclaimers = buildDisclaimers(citations, structured?.disclaimer)

  return providerAIResponseSchema.parse({
    content,
    disclaimer: disclaimers[0],
    disclaimers,
    citations,
    provider: args.provider,
    model: args.model,
    cost: Math.round(args.cost * 10000) / 10000,
    usage: args.usage,
  })
}