import { timingSafeEqual } from 'crypto'

import { z } from 'zod'

// ---------------------------------------------------------------------------
// SCIM 2.0 Types & Helpers
// ---------------------------------------------------------------------------

export const SCIM_SCHEMAS = {
  User: 'urn:ietf:params:scim:schemas:core:2.0:User',
  Group: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  ListResponse: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  PatchOp: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
  Error: 'urn:ietf:params:scim:api:messages:2.0:Error',
} as const

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const scimUserCreateSchema = z.object({
  schemas: z.array(z.string()).default([SCIM_SCHEMAS.User]),
  userName: z.string().email('userName must be a valid email'),
  name: z.object({
    givenName: z.string().optional(),
    familyName: z.string().optional(),
    formatted: z.string().optional(),
  }).optional(),
  emails: z.array(z.object({
    value: z.string().email(),
    type: z.string().optional(),
    primary: z.boolean().optional(),
  })).optional(),
  displayName: z.string().optional(),
  active: z.boolean().default(true),
  externalId: z.string().optional(),
})

export const scimPatchSchema = z.object({
  schemas: z.array(z.string()),
  Operations: z.array(z.object({
    op: z.enum(['add', 'replace', 'remove']),
    path: z.string().optional(),
    value: z.unknown().optional(),
  })),
})

export type ScimUserCreate = z.infer<typeof scimUserCreateSchema>
export type ScimPatchOp = z.infer<typeof scimPatchSchema>

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function validateScimAuth(request: Request): boolean {
  const secret = process.env.SCIM_SHARED_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false
  const expected = `Bearer ${secret}`
  if (authHeader.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function toScimUser(user: {
  id: string
  email: string
  name: string | null
  active?: boolean
  createdAt: Date
  updatedAt: Date
}, baseUrl: string) {
  return {
    schemas: [SCIM_SCHEMAS.User],
    id: user.id,
    userName: user.email,
    name: {
      formatted: user.name || undefined,
    },
    emails: [
      { value: user.email, type: 'work', primary: true },
    ],
    displayName: user.name || user.email,
    active: user.active !== false,
    meta: {
      resourceType: 'User',
      created: user.createdAt.toISOString(),
      lastModified: user.updatedAt.toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${user.id}`,
    },
  }
}

export function toScimGroup(group: {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  members?: Array<{ userId: string }>
}, baseUrl: string) {
  return {
    schemas: [SCIM_SCHEMAS.Group],
    id: group.id,
    displayName: group.name,
    members: (group.members || []).map((m) => ({
      value: m.userId,
      $ref: `${baseUrl}/api/scim/v2/Users/${m.userId}`,
    })),
    meta: {
      resourceType: 'Group',
      created: group.createdAt.toISOString(),
      lastModified: group.updatedAt.toISOString(),
      location: `${baseUrl}/api/scim/v2/Groups/${group.id}`,
    },
  }
}

export function toScimListResponse(resources: unknown[], totalResults: number, startIndex: number) {
  return {
    schemas: [SCIM_SCHEMAS.ListResponse],
    totalResults,
    itemsPerPage: resources.length,
    startIndex,
    Resources: resources,
  }
}

export function scimError(status: number, detail: string) {
  return {
    schemas: [SCIM_SCHEMAS.Error],
    status: String(status),
    detail,
  }
}

// ---------------------------------------------------------------------------
// Filter parser (minimal: supports `userName eq "value"`)
// ---------------------------------------------------------------------------

export function parseScimFilter(filter: string | null): { field: string; op: string; value: string } | null {
  if (!filter) return null
  const match = filter.match(/^(\w+)\s+(eq|co|sw)\s+"([^"]*)"$/i)
  if (!match) return null
  return { field: match[1], op: match[2].toLowerCase(), value: match[3] }
}

// ---------------------------------------------------------------------------
// Patch operation applier
// ---------------------------------------------------------------------------

export function applyScimPatch(
  current: Record<string, unknown>,
  operations: ScimPatchOp['Operations']
): Record<string, unknown> {
  const result = { ...current }
  for (const op of operations) {
    if (op.op === 'replace' && op.path) {
      result[op.path] = op.value
    } else if (op.op === 'add' && op.path) {
      result[op.path] = op.value
    } else if (op.op === 'remove' && op.path) {
      delete result[op.path]
    }
  }
  return result
}
