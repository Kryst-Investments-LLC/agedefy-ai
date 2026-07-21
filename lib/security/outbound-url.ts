import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

type LookupAddress = { address: string; family: number }
type Resolver = (hostname: string) => Promise<LookupAddress[]>

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.internal.",
])

function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]
  if (normalized === "::" || normalized === "::1") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : null)
  if (!ipv4) return false
  const [a, b] = ipv4.split(".").map(Number)
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
}

const defaultResolver: Resolver = async (hostname) => lookup(hostname, { all: true, verbatim: true })

/** Reject URLs capable of reaching local, private, link-local, or metadata services. */
export async function assertSafeOutboundUrl(rawUrl: string, resolver: Resolver = defaultResolver) {
  const url = new URL(rawUrl)
  if (url.protocol !== "https:") throw new Error("External endpoints must use HTTPS")
  if (url.username || url.password) throw new Error("External endpoint credentials must not be embedded in URLs")

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("External endpoint hostname is not allowed")
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname)
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("External endpoint resolves to a non-public address")
  }
  return url
}
