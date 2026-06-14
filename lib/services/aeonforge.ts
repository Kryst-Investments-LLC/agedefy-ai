import { discoverCandidatesLocal } from '@/lib/aeonforge/engine';
import { type EvidenceGrade } from '@/lib/aeonforge/evidence-grade';
import { runSimulations } from '@/lib/aeonforge/simulation';
import { generateVirtualTwinLocal } from '@/lib/aeonforge/virtual-twin';
import { logger } from '@/lib/logger';
import type { CandidateRealityCheck } from '@/lib/services/candidate-reality-check';

/**
 * ÆonForge Service Client
 * Typed client for pharmaceutical discovery platform.
 * When AEONFORGE_API_ENDPOINT is configured, calls the external API.
 * Otherwise, falls back to the local discovery engine that uses the platform's
 * AI providers (OpenAI / Anthropic / Grok) and biomedical-intelligence library.
 */

export interface AeonForgePromptRequest {
  prompt: string;
  userId: string;
  userContext?: {
    age?: number;
    biomarkers?: Record<string, number>;
    geneticsSummary?: string;
    healthHistory?: string;
    goals?: string[];
  };
  discoveryTier?: 'explorer' | 'pro' | 'enterprise';
  includeSimulation?: boolean;
  includeVirtualTwin?: boolean;
}

export interface AeonForgeCandidateMolecule {
  id: string;
  iupacName: string;
  commonName?: string;
  smiles: string;
  mechanism: string;
  targetPathways: string[];
  potentialSynergies?: string[];
  estimatedHealthspanGain?: number; // days
  safetyProfile: {
    toxicity: number; // 0-1
    contraindications: string[];
    knownAdverseEvents?: string[];
  };
  /** Real-world verification against PubChem + ChEMBL. Set by the local engine after candidate generation. */
  realityCheck?: CandidateRealityCheck;
}

export interface SimulationData {
  type: 'virtual_cell' | 'organ' | 'whole_body' | 'immunogenicity' | 'senolytic_prediction';
  confidence: number; // 0-1
  result: {
    primaryOutcome: string;
    secondaryOutcomes?: string[];
    estimatedEffect?: number;
    confidenceRatio?: string;
  };
}

export interface VirtualTwinProfile {
  biologicalAge: number;
  hallmarkResponsePredictions: {
    genomicInstability: number;
    telomereDysfunction: number;
    epigeneticAlteration: number;
    lossOfProteostasis: number;
    disabledMacroautophagy: number;
    mitochondrialDysfunction: number;
    cellularSenescence: number;
    stemCellExhaustion: number;
    alteredIntercelularCommunication: number;
  };
}

export interface AeonForgeResponse {
  status: 'success' | 'partial' | 'error';
  requestId: string;
  candidates: AeonForgeCandidateMolecule[];
  simulationResults?: SimulationData[];
  virtualTwinProfile?: VirtualTwinProfile;
  confidence: number;
  evidenceGrade?: EvidenceGrade;
  candidateEvidenceGrades?: EvidenceGrade[];
  modelVersion: string;
  warnings?: string[];
  disclaimers: string[];
  executionTimeMs: number;
}

interface RetryOptions {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
}

class AeonForgeService {
  private apiEndpoint: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;
  private requestCache: Map<string, { response: AeonForgeResponse; timestamp: number }>;
  private cacheTimeMs = 3600000; // 1 hour

  constructor() {
    this.apiEndpoint = process.env.AEONFORGE_API_ENDPOINT || '';
    this.apiKey = process.env.AEONFORGE_API_KEY || '';
    this.timeoutMs = parseInt(process.env.AEONFORGE_TIMEOUT_MS || '300000', 10);
    this.maxRetries = parseInt(process.env.AEONFORGE_MAX_RETRIES || '2', 10);
    this.requestCache = new Map();

    if (!this.apiEndpoint || !this.apiKey) {
      logger.warn('ÆonForge service: API endpoint or key not configured');
    }
  }

  /**
   * Primary discovery endpoint: prompt-to-candidate
   * Accepts natural language scientific prompt, returns ranked molecular/antigenic candidates
   * Falls back to local engine when external API is not configured.
   */
  async discoverCandidates(
    request: AeonForgePromptRequest
  ): Promise<AeonForgeResponse> {
    if (!this.apiEndpoint || !this.apiKey) {
      return discoverCandidatesLocal(request);
    }
    return this.executeWithRetry(() =>
      this.callAeonForgeAPI('/v1/discover', request)
    );
  }

  /**
   * Run simulations on candidate molecules
   * Types: virtual_cell, organ, whole_body, immunogenicity, senolytic_prediction
   * Falls back to local simulation runner when external API is not configured.
   */
  async simulateCandidates(
    candidates: AeonForgeCandidateMolecule[],
    simulationTypes: string[],
    userContext?: Record<string, unknown>
  ): Promise<SimulationData[]> {
    if (!this.apiEndpoint || !this.apiKey) {
      return runSimulations(candidates, simulationTypes, userContext);
    }
    try {
      const response = await this.executeWithRetry(() =>
        this.callAeonForgeAPI('/v1/simulate', {
          candidates,
          simulationTypes,
          userContext,
        })
      );
      return response.simulationResults || [];
    } catch (error) {
      logger.error('ÆonForge simulation failed', { error });
      throw error;
    }
  }

  /**
   * Generate digital twin profile for user
   * Predicts multi-hallmark aging response to intervention
   * Falls back to local virtual-twin generator when external API is not configured.
   */
  async generateVirtualTwin(
    candidates: AeonForgeCandidateMolecule[],
    userContext: {
      age: number;
      biomarkers: Record<string, number>;
      geneticsSummary?: string;
    }
  ): Promise<VirtualTwinProfile> {
    if (!this.apiEndpoint || !this.apiKey) {
      return generateVirtualTwinLocal(candidates, userContext);
    }
    try {
      const response = await this.executeWithRetry(() =>
        this.callAeonForgeAPI('/v1/virtual-twin', {
          candidates,
          userContext,
        })
      );
      if (!response.virtualTwinProfile) {
        throw new Error('AeonForge virtual twin response did not include a profile');
      }

      return response.virtualTwinProfile;
    } catch (error) {
      logger.error('ÆonForge virtual twin generation failed', { error });
      throw error;
    }
  }

  /**
   * Low-level API call with timeout, retry, and error handling
   */
  private async callAeonForgeAPI(
    endpoint: string,
    payload: unknown
  ): Promise<AeonForgeResponse> {
    if (!this.apiEndpoint || !this.apiKey) {
      throw new Error(
        'ÆonForge service not configured. Set AEONFORGE_API_ENDPOINT and AEONFORGE_API_KEY.'
      );
    }

    // Check cache for deterministic requests
    const cacheKey = this.getCacheKey(endpoint, payload);
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeMs) {
      logger.debug('ÆonForge cache hit', { endpoint, cacheKey });
      return cached.response;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiEndpoint}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Client': 'biozephyra-ai',
          'X-Request-ID': this.generateRequestId(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `ÆonForge API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const data: AeonForgeResponse = await response.json();

      // Cache successful responses
      this.requestCache.set(cacheKey, {
        response: data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `ÆonForge API request timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }

  /**
   * Execute with exponential backoff retry strategy
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config: RetryOptions = {
      maxRetries: options.maxRetries ?? this.maxRetries,
      retryDelayMs: options.retryDelayMs ?? 1000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === config.maxRetries) {
          logger.error('ÆonForge API: max retries exceeded', {
            attempts: attempt + 1,
            error: lastError.message,
          });
          throw lastError;
        }

        const delayMs = config.retryDelayMs * Math.pow(config.backoffMultiplier, attempt);
        logger.warn('ÆonForge API retry', {
          attempt: attempt + 1,
          delayMs,
          error: lastError.message,
        });

        await this.sleep(delayMs);
      }
    }

    throw lastError || new Error('Unknown error in retry loop');
  }

  /**
   * Generate deterministic cache key from endpoint and payload
   */
  private getCacheKey(endpoint: string, payload: unknown): string {
    const payloadStr = JSON.stringify(payload);
    return `${endpoint}:${Buffer.from(payloadStr).toString('base64').slice(0, 32)}`;
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `af-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Sleep utility for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check and configuration validation
   */
  async validateConfiguration(): Promise<boolean> {
    if (!this.apiEndpoint || !this.apiKey) {
      logger.warn('ÆonForge service: Incomplete configuration');
      return false;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/v1/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      logger.error('ÆonForge health check failed', { error });
      return false;
    }
  }

  /**
   * Clear cache (e.g., on logout or for testing)
   */
  clearCache(): void {
    this.requestCache.clear();
  }
}

// Export singleton instance
export const aeonforgeService = new AeonForgeService();
