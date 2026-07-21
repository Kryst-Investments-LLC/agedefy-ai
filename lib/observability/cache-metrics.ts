import { metrics } from "@opentelemetry/api"

// In-process cache observability (P1-PERF-021). Hit rate is derived in the
// backend from hit / (hit + miss); eviction tracks pressure on the size cap.
// `cache` labels the cache by name so all in-process caches share one metric.
const meter = metrics.getMeter("biozephyra")

const cacheHitCounter = meter.createCounter("biozephyra.cache.hit.count", {
  description: "In-process cache hits, labeled by cache name",
})
const cacheMissCounter = meter.createCounter("biozephyra.cache.miss.count", {
  description: "In-process cache misses, labeled by cache name",
})
const cacheEvictionCounter = meter.createCounter("biozephyra.cache.eviction.count", {
  description: "In-process cache evictions (size cap or TTL), labeled by cache name",
})

export function recordCacheHit(cache: string): void {
  cacheHitCounter.add(1, { cache })
}

export function recordCacheMiss(cache: string): void {
  cacheMissCounter.add(1, { cache })
}

export function recordCacheEviction(cache: string, count = 1): void {
  if (count > 0) cacheEvictionCounter.add(count, { cache })
}
