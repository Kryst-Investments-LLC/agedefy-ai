import { NextResponse } from 'next/server'

import { validateScimAuth } from '@/lib/scim'

/**
 * GET /api/scim/v2/ResourceTypes
 * SCIM 2.0 ResourceTypes discovery endpoint (RFC 7643 §6)
 */
export async function GET(request: Request) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(
      { schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Unauthorized', status: 401 },
      { status: 401 },
    )
  }

  return NextResponse.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 2,
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        meta: {
          resourceType: 'ResourceType',
          location: '/api/scim/v2/ResourceTypes/User',
        },
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        description: 'Group',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        meta: {
          resourceType: 'ResourceType',
          location: '/api/scim/v2/ResourceTypes/Group',
        },
      },
    ],
  })
}
