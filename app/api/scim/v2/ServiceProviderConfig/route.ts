import { NextResponse } from 'next/server'

import { validateScimAuth } from '@/lib/scim'

/**
 * GET /api/scim/v2/ServiceProviderConfig
 * SCIM 2.0 ServiceProviderConfig discovery endpoint (RFC 7643 §5)
 */
export async function GET(request: Request) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(
      { schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Unauthorized', status: 401 },
      { status: 401 },
    )
  }

  return NextResponse.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.biozephyra.com/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication using a shared bearer token configured via SCIM_SHARED_SECRET',
        specUri: 'https://tools.ietf.org/html/rfc6750',
        primary: true,
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      location: '/api/scim/v2/ServiceProviderConfig',
    },
  })
}
