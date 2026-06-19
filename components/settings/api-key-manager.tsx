"use client"

import { useState } from "react"

interface ApiKey {
  id: string
  name: string
  prefix: string
  scopes: string
  rateLimitPerMin: number
  sandbox: boolean
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

interface CreateResult {
  key: string
  id: string
  prefix: string
  name: string
}

const AVAILABLE_SCOPES = [
  { value: "discover", label: "discover — AeonForge candidate discovery" },
  { value: "simulate", label: "simulate — AeonForge organ simulation" },
  { value: "virtual-twin", label: "virtual-twin — digital-twin predictions" },
  { value: "graph:read", label: "graph:read — RWE outcomes graph API" },
]

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: "",
    scopes: ["discover"] as string[],
    sandbox: false,
    expiresInDays: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // keyId being acted on

  async function refreshKeys() {
    const res = await fetch("/api/v1/auth/keys")
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] }
      setKeys(data.keys)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setNewKey(null)

    const body: Record<string, unknown> = {
      name: form.name,
      scopes: form.scopes,
      sandbox: form.sandbox,
    }
    if (form.expiresInDays) body.expiresInDays = Number(form.expiresInDays)

    const res = await fetch("/api/v1/auth/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await res.json() as CreateResult & { error?: string }
    setCreating(false)

    if (!res.ok) {
      setError(data.error ?? "Failed to create key")
      return
    }

    setNewKey(data.key)
    setShowForm(false)
    setForm({ name: "", scopes: ["discover"], sandbox: false, expiresInDays: "" })
    await refreshKeys()
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this key? All requests using it will immediately fail.")) return
    setBusy(keyId)
    setError(null)
    const res = await fetch("/api/v1/auth/keys", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyId }),
    })
    setBusy(null)
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Revoke failed")
      return
    }
    await refreshKeys()
  }

  async function handleRotate(keyId: string) {
    if (!confirm("Rotate this key? A new key will be issued and this one revoked immediately.")) return
    setBusy(keyId)
    setError(null)
    const res = await fetch("/api/v1/auth/keys", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyId }),
    })
    const data = await res.json() as CreateResult & { error?: string }
    setBusy(null)
    if (!res.ok) {
      setError(data.error ?? "Rotate failed")
      return
    }
    setNewKey(data.key)
    await refreshKeys()
  }

  function toggleScope(scope: string) {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope)
        ? f.scopes.filter((s) => s !== scope)
        : [...f.scopes, scope],
    }))
  }

  const active = keys.filter((k) => !k.revokedAt)
  const revoked = keys.filter((k) => k.revokedAt)

  return (
    <div className="space-y-8">
      {/* One-time key display */}
      {newKey && (
        <div className="rounded-lg border border-green-400 bg-green-50 dark:bg-green-950/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            New key — copy it now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-green-100 dark:bg-green-900/40 px-3 py-2 text-sm font-mono break-all">
              {newKey}
            </code>
            <button
              onClick={() => { void navigator.clipboard.writeText(newKey) }}
              className="shrink-0 rounded border px-3 py-2 text-xs hover:bg-muted"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-muted-foreground underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <p className="rounded border border-red-300 bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Create form toggle */}
      <div>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + Create API Key
          </button>
        ) : (
          <form onSubmit={(e) => { void handleCreate(e) }} className="rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold">New API Key</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Production integration"
                className="w-full rounded border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Scopes</label>
              <div className="space-y-1">
                {AVAILABLE_SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.scopes.includes(s.value)}
                      onChange={() => toggleScope(s.value)}
                    />
                    <code className="text-xs bg-muted px-1 rounded">{s.value}</code>
                    <span className="text-muted-foreground">{s.label.split("—")[1]?.trim()}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sandbox"
                checked={form.sandbox}
                onChange={(e) => setForm((f) => ({ ...f, sandbox: e.target.checked }))}
              />
              <label htmlFor="sandbox" className="text-sm cursor-pointer">
                Sandbox mode — returns deterministic mock responses, no AI credits consumed
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Expires in days <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.expiresInDays}
                onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}
                placeholder="Leave blank for no expiry"
                className="w-40 rounded border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || form.scopes.length === 0}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null) }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Active keys table */}
      <section>
        <h3 className="text-base font-semibold mb-3">Active keys ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active keys. Create one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Prefix</th>
                  <th className="text-left p-3 font-medium">Scopes</th>
                  <th className="text-left p-3 font-medium">Mode</th>
                  <th className="text-left p-3 font-medium">Last used</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {active.map((k) => (
                  <tr key={k.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{k.name}</td>
                    <td className="p-3">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{k.prefix}…</code>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.split(",").map((s) => (
                          <span key={s} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {k.sandbox
                        ? <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">sandbox</span>
                        : <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">live</span>
                      }
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          disabled={busy === k.id}
                          onClick={() => { void handleRotate(k.id) }}
                          className="text-xs border rounded px-2 py-1 hover:bg-muted disabled:opacity-50"
                        >
                          Rotate
                        </button>
                        <button
                          disabled={busy === k.id}
                          onClick={() => { void handleRevoke(k.id) }}
                          className="text-xs border border-red-200 text-red-600 rounded px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Revoked keys — collapsed */}
      {revoked.length > 0 && (
        <section>
          <details>
            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
              {revoked.length} revoked key{revoked.length !== 1 ? "s" : ""}
            </summary>
            <div className="mt-2 overflow-x-auto rounded-lg border opacity-60">
              <table className="w-full text-sm">
                <tbody>
                  {revoked.map((k) => (
                    <tr key={k.id} className="border-b last:border-0">
                      <td className="p-3 line-through text-muted-foreground">{k.name}</td>
                      <td className="p-3">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{k.prefix}…</code>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        Revoked {k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
