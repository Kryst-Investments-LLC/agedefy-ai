import type { Metadata } from "next"
import Link from "next/link"

import { AppShell } from "@/components/app-shell"

export const metadata: Metadata = {
  title: "Developer Portal | Biozephyra ÆonForge API",
  description:
    "API documentation, authentication guide, and interactive reference for the ÆonForge longevity-science discovery API.",
}

export default function DeveloperPortalPage() {
  return (
    <AppShell pageTitle="Developer Portal">
    <div className="container mx-auto max-w-4xl px-4 py-10 space-y-10">
      {/* Hero */}
      <section>
        <h1 className="text-3xl font-bold tracking-tight">
          ÆonForge API — Developer Portal
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Programmatic access to Biozephyra&apos;s longevity-science discovery engine.
          Submit natural-language prompts, receive ranked candidate molecules,
          run multi-organ simulations, and generate digital-twin hallmark
          predictions — all via a simple REST API.
        </p>
      </section>

      {/* Quick start */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Quick Start</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>
            Create an API key from your{" "}
            <Link href="/settings" className="text-blue-600 underline">
              account settings
            </Link>{" "}
            or via the{" "}
            <code className="bg-muted px-1 rounded text-xs">
              POST /api/v1/auth/keys
            </code>{" "}
            endpoint.
          </li>
          <li>
            Store the key securely — it is shown only once at creation.
          </li>
          <li>
            Pass it as{" "}
            <code className="bg-muted px-1 rounded text-xs">
              Authorization: Bearer ak_…
            </code>{" "}
            in every v1 request.
          </li>
        </ol>
      </section>

      {/* Authentication */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Authentication</h2>
        <p className="text-sm mb-2">
          All <code className="bg-muted px-1 rounded text-xs">/api/v1/aeonforge/*</code>{" "}
          endpoints require a valid API key.
        </p>
        <div className="rounded-lg border bg-muted/50 p-4 text-sm font-mono">
          Authorization: Bearer ak_your_key_here
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Keys prefixed <strong>ak_</strong> are production keys. Sandbox keys
          return deterministic mock responses without consuming AI tokens — perfect
          for integration testing.
        </p>
      </section>

      {/* Endpoints */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Endpoints</h2>

        <div className="space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/aeonforge/discover"
            scope="discover"
            description="Submit a scientific prompt and receive ranked candidate molecules worth testing — exploratory hypotheses, not confirmed hits."
            body={`{
  "prompt": "Find senolytics targeting p16-positive cells",
  "discoveryTier": "pro",
  "includeSimulation": true,
  "userContext": { "age": 45, "goals": ["longevity"] }
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/v1/aeonforge/simulate"
            scope="simulate"
            description="Run virtual-cell, organ, or whole-body simulations on candidate molecules."
            body={`{
  "candidates": [{ "id": "...", "smiles": "...", ... }],
  "simulationTypes": ["virtual_cell", "whole_body"]
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/v1/aeonforge/virtual-twin"
            scope="virtual-twin"
            description="Generate a digital-twin profile predicting multi-hallmark ageing response to an intervention."
            body={`{
  "candidates": [{ "id": "...", "smiles": "...", ... }],
  "userContext": { "age": 45, "biomarkers": { "CRP": 1.2 } }
}`}
          />
        </div>
      </section>

      {/* Key management */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Key Management</h2>
        <div className="space-y-4">
          <EndpointCard
            method="POST"
            path="/api/v1/auth/keys"
            scope="session"
            description="Create a new API key (requires session auth, not API key). Returns the raw key once."
            body={`{ "name": "My integration", "sandbox": false }`}
          />
          <EndpointCard
            method="GET"
            path="/api/v1/auth/keys"
            scope="session"
            description="List your API keys (masked, no hashes)."
            body=""
          />
          <EndpointCard
            method="DELETE"
            path="/api/v1/auth/keys"
            scope="session"
            description="Revoke a key."
            body={`{ "keyId": "clx..." }`}
          />
          <EndpointCard
            method="PATCH"
            path="/api/v1/auth/keys"
            scope="session"
            description="Rotate a key — revokes old, issues new with same config."
            body={`{ "keyId": "clx..." }`}
          />
        </div>
      </section>

      {/* Rate limits */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Rate Limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2">Tier</th>
                <th className="text-left p-2">Requests / min</th>
                <th className="text-left p-2">Monthly limit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2">Free</td>
                <td className="p-2">10</td>
                <td className="p-2">100 calls</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Pro</td>
                <td className="p-2">60</td>
                <td className="p-2">10,000 calls</td>
              </tr>
              <tr>
                <td className="p-2">Enterprise</td>
                <td className="p-2">Custom</td>
                <td className="p-2">Custom</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Per-key limits are set at creation. 429 responses include{" "}
          <code className="bg-muted px-1 rounded text-xs">Retry-After</code>{" "}
          and <code className="bg-muted px-1 rounded text-xs">X-RateLimit-Remaining</code>{" "}
          headers.
        </p>
      </section>

      {/* OpenAPI */}
      <section>
        <h2 className="text-xl font-semibold mb-3">OpenAPI Spec</h2>
        <p className="text-sm">
          Machine-readable spec available at{" "}
          <code className="bg-muted px-1 rounded text-xs">/api/v1/openapi.json</code>.
        </p>
      </section>

      {/* Errors */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Error Codes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="p-2">400</td><td className="p-2">Invalid request body / validation failure</td></tr>
              <tr className="border-b"><td className="p-2">401</td><td className="p-2">Missing or invalid API key</td></tr>
              <tr className="border-b"><td className="p-2">403</td><td className="p-2">Key lacks required scope</td></tr>
              <tr className="border-b"><td className="p-2">429</td><td className="p-2">Rate limit exceeded</td></tr>
              <tr><td className="p-2">500</td><td className="p-2">Internal engine error</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </AppShell>
  )
}

function EndpointCard({
  method,
  path,
  scope,
  description,
  body,
}: {
  method: string
  path: string
  scope: string
  description: string
  body: string
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    PATCH: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  }

  return (
    <div className="rounded-lg border dark:border-gray-700">
      <div className="flex items-center gap-3 px-4 py-2 border-b dark:border-gray-700">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${methodColors[method] ?? ""}`}>
          {method}
        </span>
        <code className="text-sm font-mono">{path}</code>
        <span className="ml-auto text-xs text-muted-foreground">scope: {scope}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm">{description}</p>
        {body && (
          <pre className="mt-2 rounded bg-muted/50 p-3 text-xs overflow-x-auto">
            {body}
          </pre>
        )}
      </div>
    </div>
  )
}
