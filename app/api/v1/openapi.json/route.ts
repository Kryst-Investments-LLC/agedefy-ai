import { NextResponse } from 'next/server'

/**
 * GET /api/v1/openapi.json
 *
 * Serves the OpenAPI 3.1 spec for the ÆonForge external API.
 */
export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'ÆonForge Longevity Discovery API',
      version: '1.0.0',
      description:
        'Programmatic access to Biozephyra\'s AI-powered longevity-science discovery engine. ' +
        'Submit natural-language scientific prompts, receive ranked candidate molecules, ' +
        'run multi-organ simulations, and generate digital-twin hallmark predictions.',
      contact: { email: 'api@biozephyra.com' },
      license: { name: 'Proprietary' },
    },
    servers: [
      { url: '/', description: 'Current host' },
    ],
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/aeonforge/discover': {
        post: {
          operationId: 'discover',
          summary: 'Discover candidate molecules',
          description: 'Submit a scientific prompt and receive ranked candidate molecules with safety profiles.',
          tags: ['Discovery'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DiscoverRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful discovery',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AeonForgeResponse' },
                },
              },
            },
            '400': { description: 'Validation error' },
            '401': { description: 'Invalid API key' },
            '403': { description: 'Missing scope' },
            '429': { description: 'Rate limit exceeded' },
            '500': { description: 'Engine error' },
          },
        },
      },
      '/api/v1/aeonforge/simulate': {
        post: {
          operationId: 'simulate',
          summary: 'Run simulations on candidates',
          description: 'Run virtual-cell, organ, or whole-body simulations on candidate molecules.',
          tags: ['Simulation'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SimulateRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Simulation results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      simulations: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/SimulationData' },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation error' },
            '401': { description: 'Invalid API key' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/v1/aeonforge/virtual-twin': {
        post: {
          operationId: 'virtualTwin',
          summary: 'Generate digital-twin profile',
          description: 'Predict multi-hallmark ageing response to an intervention.',
          tags: ['Virtual Twin'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VirtualTwinRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Virtual twin profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      virtualTwin: { $ref: '#/components/schemas/VirtualTwinProfile' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation error' },
            '401': { description: 'Invalid API key' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/v1/auth/keys': {
        post: {
          operationId: 'createKey',
          summary: 'Create an API key',
          description: 'Session-authenticated. Returns the raw key once.',
          tags: ['Key Management'],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', maxLength: 100 },
                    scopes: {
                      type: 'array',
                      items: { type: 'string', enum: ['discover', 'simulate', 'virtual-twin'] },
                    },
                    rateLimitPerMin: { type: 'integer', minimum: 1, maximum: 1000 },
                    sandbox: { type: 'boolean' },
                    expiresInDays: { type: 'integer', minimum: 1, maximum: 365 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Key created — raw key in response' },
            '401': { description: 'Unauthorized' },
          },
        },
        get: {
          operationId: 'listKeys',
          summary: 'List API keys',
          tags: ['Key Management'],
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Array of key metadata' },
          },
        },
        delete: {
          operationId: 'revokeKey',
          summary: 'Revoke an API key',
          tags: ['Key Management'],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['keyId'],
                  properties: { keyId: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Key revoked' },
            '404': { description: 'Key not found' },
          },
        },
        patch: {
          operationId: 'rotateKey',
          summary: 'Rotate an API key',
          tags: ['Key Management'],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['keyId'],
                  properties: { keyId: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'New key returned' },
            '404': { description: 'Key not found' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key: Authorization: Bearer ak_…',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
          description: 'NextAuth session cookie (for key management endpoints)',
        },
      },
      schemas: {
        DiscoverRequest: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string', minLength: 10, maxLength: 5000 },
            discoveryTier: { type: 'string', enum: ['explorer', 'pro', 'enterprise'] },
            includeSimulation: { type: 'boolean' },
            includeVirtualTwin: { type: 'boolean' },
            userContext: {
              type: 'object',
              properties: {
                age: { type: 'integer', minimum: 1, maximum: 150 },
                biomarkers: { type: 'object', additionalProperties: { type: 'number' } },
                geneticsSummary: { type: 'string' },
                healthHistory: { type: 'string' },
                goals: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        SimulateRequest: {
          type: 'object',
          required: ['candidates', 'simulationTypes'],
          properties: {
            candidates: { type: 'array', items: { $ref: '#/components/schemas/CandidateMolecule' }, minItems: 1, maxItems: 10 },
            simulationTypes: {
              type: 'array',
              items: { type: 'string', enum: ['virtual_cell', 'organ', 'whole_body', 'immunogenicity', 'senolytic_prediction'] },
            },
            userContext: { type: 'object' },
          },
        },
        VirtualTwinRequest: {
          type: 'object',
          required: ['candidates', 'userContext'],
          properties: {
            candidates: { type: 'array', items: { $ref: '#/components/schemas/CandidateMolecule' }, minItems: 1, maxItems: 5 },
            userContext: {
              type: 'object',
              required: ['age', 'biomarkers'],
              properties: {
                age: { type: 'integer', minimum: 1, maximum: 150 },
                biomarkers: { type: 'object', additionalProperties: { type: 'number' } },
                geneticsSummary: { type: 'string' },
              },
            },
          },
        },
        CandidateMolecule: {
          type: 'object',
          required: ['id', 'iupacName', 'smiles', 'mechanism', 'targetPathways', 'safetyProfile'],
          properties: {
            id: { type: 'string' },
            iupacName: { type: 'string' },
            commonName: { type: 'string' },
            smiles: { type: 'string' },
            mechanism: { type: 'string' },
            targetPathways: { type: 'array', items: { type: 'string' } },
            potentialSynergies: { type: 'array', items: { type: 'string' } },
            estimatedHealthspanGain: { type: 'number', description: 'Estimated gain in days' },
            safetyProfile: {
              type: 'object',
              properties: {
                toxicity: { type: 'number', minimum: 0, maximum: 1 },
                contraindications: { type: 'array', items: { type: 'string' } },
                knownAdverseEvents: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        AeonForgeResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['success', 'partial', 'error'] },
            requestId: { type: 'string' },
            candidates: { type: 'array', items: { $ref: '#/components/schemas/CandidateMolecule' } },
            simulationResults: { type: 'array', items: { $ref: '#/components/schemas/SimulationData' } },
            virtualTwinProfile: { $ref: '#/components/schemas/VirtualTwinProfile' },
            confidence: { type: 'number' },
            modelVersion: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
            disclaimers: { type: 'array', items: { type: 'string' } },
            executionTimeMs: { type: 'number' },
          },
        },
        SimulationData: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            confidence: { type: 'number' },
            result: {
              type: 'object',
              properties: {
                primaryOutcome: { type: 'string' },
                secondaryOutcomes: { type: 'array', items: { type: 'string' } },
                estimatedEffect: { type: 'number' },
              },
            },
          },
        },
        VirtualTwinProfile: {
          type: 'object',
          properties: {
            biologicalAge: { type: 'number' },
            hallmarkResponsePredictions: {
              type: 'object',
              properties: {
                genomicInstability: { type: 'number' },
                telomereDysfunction: { type: 'number' },
                epigeneticAlteration: { type: 'number' },
                lossOfProteostasis: { type: 'number' },
                disabledMacroautophagy: { type: 'number' },
                mitochondrialDysfunction: { type: 'number' },
                cellularSenescence: { type: 'number' },
                stemCellExhaustion: { type: 'number' },
                alteredIntercelularCommunication: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
