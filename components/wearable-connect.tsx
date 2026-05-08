"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plug, PlugZap, Unplug, Wifi, WifiOff } from "lucide-react"

interface WearableConnection {
  id: string
  provider: string
  status: string
  connectedAt: string
  lastSyncAt: string | null
}

const SUPPORTED_PROVIDERS = [
  { id: "fitbit", name: "Fitbit", icon: "⌚" },
  { id: "garmin", name: "Garmin", icon: "🏃" },
  { id: "apple", name: "Apple Health", icon: "🍎" },
  { id: "google", name: "Google Fit", icon: "🔵" },
  { id: "oura", name: "Oura Ring", icon: "💍" },
  { id: "whoop", name: "WHOOP", icon: "🔴" },
  { id: "samsung", name: "Samsung Health", icon: "📱" },
  { id: "withings", name: "Withings", icon: "⚖️" },
  { id: "polar", name: "Polar", icon: "❄️" },
  { id: "huawei", name: "Huawei Health", icon: "🟢" },
]

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function WearableConnectCard() {
  const [connections, setConnections] = useState<WearableConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/wearables/connect")
      if (res.ok) {
        const data = await res.json()
        setConnections(data.connections ?? [])
      }
    } catch {
      // Silently fail on load
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch("/api/wearables/connect", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to start connection")
        return
      }
      const data = await res.json()
      if (data.widgetUrl) {
        window.open(data.widgetUrl, "_blank", "noopener,noreferrer")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider)
    setError(null)
    try {
      const res = await fetch("/api/wearables/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      if (res.ok) {
        await fetchConnections()
      } else {
        const data = await res.json()
        setError(data.error ?? "Failed to disconnect")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setDisconnecting(null)
    }
  }

  const activeConnections = connections.filter((c) => c.status === "active")
  const connectedProviderIds = new Set(activeConnections.map((c) => c.provider))

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PlugZap className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Wearable Devices</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {activeConnections.length} connected
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Active connections */}
          {activeConnections.length > 0 && (
            <div className="mb-4 space-y-2">
              {activeConnections.map((conn) => {
                const provider = SUPPORTED_PROVIDERS.find(
                  (p) => p.id === conn.provider,
                )
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {provider?.icon ?? "📡"}
                      </span>
                      <div>
                        <p className="font-medium text-sm">
                          {provider?.name ?? conn.provider}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wifi className="h-3 w-3 text-green-500" />
                          Connected
                          {conn.lastSyncAt && (
                            <> · Last sync {timeAgo(conn.lastSyncAt)}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(conn.provider)}
                      disabled={disconnecting === conn.provider}
                      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      {disconnecting === conn.provider ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Unplug className="h-3 w-3" />
                      )}
                      Disconnect
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Connect new device button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 py-4 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening connection widget…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Connect a Device
              </span>
            )}
          </button>

          {/* Supported providers grid */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Supported devices
            </p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_PROVIDERS.map((p) => {
                const isConnected = connectedProviderIds.has(p.id)
                return (
                  <span
                    key={p.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                      isConnected
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    <span>{p.icon}</span>
                    {p.name}
                    {isConnected && <Wifi className="h-3 w-3" />}
                  </span>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface WearableDataPoint {
  activityContext?: string
  deviceManufacturer?: string
  metrics: Array<{
    name: string
    value: number
    unit: string
  }>
  timestamp: string
}

export function WearableDataFeed() {
  const [data, setData] = useState<WearableDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/wearables/data?limit=20")
        if (res.ok) {
          const json = await res.json()
          setData(json.records ?? [])
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
        <div className="text-center py-8">
          <WifiOff className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No wearable data yet. Connect a device to start syncing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-lg font-semibold mb-4">Recent Wearable Data</h3>
      <div className="space-y-3">
        {data.map((dp, i) => (
          <div
            key={i}
            className="rounded-lg border px-4 py-3 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">
                {dp.activityContext ?? "Health Data"}
              </p>
              <span className="text-xs text-muted-foreground">
                {new Date(dp.timestamp).toLocaleString()}
              </span>
            </div>
            {dp.deviceManufacturer && (
              <p className="text-xs text-muted-foreground mb-1">
                {dp.deviceManufacturer}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {dp.metrics.slice(0, 6).map((m) => (
                <span
                  key={m.name}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs"
                >
                  <span className="font-medium">{m.name}:</span>{" "}
                  {typeof m.value === "number"
                    ? m.value.toFixed(m.unit === "steps" ? 0 : 1)
                    : m.value}{" "}
                  {m.unit}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
