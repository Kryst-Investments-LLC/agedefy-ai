# Performance Bottleneck Audit

> Systematic audit of the Biozephyra platform for bottlenecks that can degrade
> functionality, increase latency, or reduce throughput at scale.

---

## Summary

| # | Severity | Area | Bottleneck | Est. Impact |
|---|----------|------|-----------|-------------|
| 1 | **CRITICAL** | DB / Audit | `logAudit()` — 4 sequential DB round-trips per mutation | Every write operation pays 4 serial DB queries |
| 2 | **CRITICAL** | DB / Search | `/api/search` — `{ contains: q }` on text columns | Full table scan (`LIKE '%q%'`) on 4 models; collapses under load |
| 3 | **CRITICAL** | DB / Export | `/api/account/export` — unbounded includes | Loads ALL biomarkers, protocols, entries with no limit; OOM risk |
| 4 | **CRITICAL** | Schema | `Biomarker`, `Protocol` — zero indexes | Most-queried user-scoped tables have no `@@index`; every lookup is a table scan |
| 5 | **HIGH** | DB / Idempotency | `executeRouteIdempotentJsonMutation` — 3-5 extra DB queries per mutation | findUnique → conditional delete → create → execute → update |
| 6 | **HIGH** | DB / Circuit Breaker | `executeWithCircuitBreaker` — 2-3 DB queries per external call | findUnique + upsert on every AI/Stripe call, even on the happy path |
| 7 | **HIGH** | Network / AI | External AI `fetch()` calls have no timeout | A slow OpenAI/Anthropic/Grok response blocks the serverless function indefinitely |
| 8 | **HIGH** | Transaction | Double Zod validation inside `$transaction` | `canonicalHealthEventSchema.parse` + `healthEventEnvelopeSchema.parse` inside every transaction |
| 9 | **HIGH** | Mutation cost | Biomarker POST end-to-end: ~15+ DB operations | See detailed breakdown below |
| 10 | **MEDIUM** | Network / Redis | UpstashRedis rate-limit — 2-3 network round-trips per request | `incr` + `pttl` + conditional `pexpire` for every rate-limited route |
| 11 | **MEDIUM** | DB / Tenancy | `deriveTenantContextWithValidation` — extra DB lookup per request | User membership query on every tenant-validated route |
| 12 | **MEDIUM** | Client | No client-side debounce or throttle on any component fetch | Only `GlobalSearch` and `CompoundMixer` have a 300ms setTimeout, all others fire immediately |
| 13 | **MEDIUM** | Client / Mixer | CompoundMixer — N parallel knowledge-graph fetches | Fires one `/api/knowledge-graph?compound=` per selected compound on every selection change |
| 14 | **MEDIUM** | Caching | Zero server-side caching (no `revalidate`, `cache()`, or `unstable_cache`) | Every server component request re-queries the database from scratch |
| 15 | **MEDIUM** | Server Component | Admin FL page — sequential waterfall | 5-query `Promise.all` followed by a separate `aggregate()` that could be parallelized |
| 16 | **LOW** | Cleanup | `InMemoryRateLimitStore` — 60s `setInterval` cleanup loop | Minor CPU overhead; cleanup frequency is fine for dev but leaks memory in long-running prod if Redis is misconfigured |

---

## Detailed Findings

### 1. CRITICAL — `logAudit()`: 4 Sequential DB Operations

**File:** `lib/audit.ts`

Every platform mutation (biomarker create, protocol update, export, etc.) calls `logAudit()`, which executes:

```
1. resolveStoredTenantContextForUser()  →  db.user.findUnique (or tenant lookup)
2. getLatestHash(tenantId)             →  db.auditLog.findFirst({ orderBy: { createdAt: 'desc' } })
3. db.auditLog.create(...)             →  INSERT
4. db.auditLog.update(...)             →  UPDATE (sets entryHash)
```

These **cannot** be parallelized because the hash chain depends on step 2's result, and step 4 needs step 3's ID.

**Fix options:**
- **Batch the create+update into a single query** using raw SQL `INSERT ... RETURNING` with computed hash.
- **Cache the latest hash per tenant** in-memory (invalidated on write) to eliminate step 2.
- **Collapse steps 3+4** by computing the hash before insert and inserting with `entryHash` populated.
- **Make audit logging async** — write to an in-memory queue and flush periodically (trades durability for latency).

---

### 2. CRITICAL — `/api/search`: Full Table Scans

**File:** `app/api/search/route.ts`

```ts
db.compound.findMany({ where: { OR: [
  { name: { contains: q } },
  { mechanism: { contains: q } },
]}})
db.learnArticle.findMany({ where: { body: { contains: q } }})
db.communityPost.findMany({ where: { body: { contains: q } }})
db.pathway.findMany({ where: { description: { contains: q } }})
```

Prisma `{ contains: q }` translates to `LIKE '%q%'` — the database cannot use any index and must scan every row.

**Fix options:**
- **PostgreSQL full-text search** using `@@` and `to_tsvector`/`to_tsquery` with a GIN index.
- **Prisma raw query** with `$queryRaw` for full-text search.
- **External search index** (Algolia, Meilisearch, Typesense) for sub-10ms results.
- **Minimum:** Add `{ mode: 'insensitive' }` and a database trigram index (`pg_trgm`) for partial match support.

---

### 3. CRITICAL — `/api/account/export`: Unbounded Query

**File:** `app/api/account/export/route.ts`

```ts
db.user.findUnique({
  where: { id: session.user.id },
  include: {
    biomarkers: { orderBy: { createdAt: "desc" } },          // ALL — no limit
    protocols: { orderBy: { createdAt: "desc" } },            // ALL — no limit
    researchCollections: { include: { entries: true } },      // ALL — no limit
    clinicianTasks: { orderBy: { createdAt: "desc" } },       // ALL — no limit
    partnerDataRecords: { orderBy: { createdAt: "desc" } },   // ALL — no limit
  },
})
```

A power user with thousands of biomarkers or research entries could cause:
- **Memory exhaustion** on the server (OOM kill).
- **Response body too large** for serverless function limits (6MB on Vercel).
- **Timeout** on the database query.

**Fix options:**
- **Stream the response** using NDJSON or cursor-based pagination.
- **Add pagination** (process in chunks, zip the result).
- **Set hard limits** (`take: 10000`) and warn the user if more exist.
- **Move to a background job** that generates a downloadable file.

---

### 4. CRITICAL — Missing Indexes on `Biomarker` and `Protocol`

**File:** `prisma/schema.prisma` (lines 283-316)

Both `Biomarker` and `Protocol` are among the most frequently queried models (dashboard loads them on every visit) but have **zero** `@@index` directives:

```prisma
model Biomarker {
  userId     String
  measuredAt DateTime
  // ... NO @@index at all
}

model Protocol {
  userId    String
  updatedAt DateTime
  // ... NO @@index at all
}
```

Every query like `db.biomarker.findMany({ where: { userId }, orderBy: { measuredAt: 'desc' } })` becomes a full table scan + filesort.

**Fix:**
```prisma
model Biomarker {
  // ...existing fields...
  @@index([userId, measuredAt])
  @@index([tenantId, userId])
}

model Protocol {
  // ...existing fields...
  @@index([userId, updatedAt])
  @@index([tenantId, userId])
}
```

---

### 5. HIGH — Idempotency Overhead: 3-5 Extra DB Queries Per Mutation

**File:** `lib/idempotency.ts`

Every call to `executeRouteIdempotentJsonMutation` executes:

```
1. reserveIdempotencyRecord()
   a. db.idempotencyRecord.findUnique (with composite key)
   b. Possibly db.idempotencyRecord.delete (if expired)
   c. db.idempotencyRecord.create
2. execute() — the actual business logic
3. db.idempotencyRecord.update — set result + COMPLETED status
```

That's 3-4 extra DB queries wrapping every single mutation.

**Fix options:**
- **Collapse reserve into a single upsert** with conditional logic (INSERT ... ON CONFLICT).
- **Move idempotency check to Redis** for sub-millisecond lookups.
- **TTL-based cleanup** via a cron job instead of inline expiry checks.

---

### 6. HIGH — Circuit Breaker: 2-3 DB Queries Per External Call

**File:** `lib/circuit-breaker.ts`

Even on the happy path (external call succeeds), `executeWithCircuitBreaker` does:

```
1. db.dependencyCircuitBreaker.findUnique({ where: { dependency } })
2. [execute the external call]
3. db.dependencyCircuitBreaker.upsert({ ... CLOSED, successCount: +1 })
```

On failure, it's the same 2 queries (findUnique + upsert).

For AI routes that already pay idempotency (3-5 queries) + audit (4 queries) + rate-limit (2-3 Redis calls), the circuit breaker adds yet more overhead.

**Fix options:**
- **Cache circuit breaker state in-memory** with TTL (check DB only on state transitions).
- **Skip the success upsert** — only write to DB on failures and state transitions.
- **Use Redis** for circuit breaker state instead of PostgreSQL.

---

### 7. HIGH — No Timeout on External AI Fetch Calls

**Files:** `app/api/ai/openai/route.ts`, `app/api/ai/anthropic/route.ts`, `app/api/ai/grok/route.ts`

All three AI provider routes call `fetch()` without an `AbortController` or timeout:

```ts
const providerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ ... }),
  // ❌ No signal, no timeout
})
```

A slow upstream response will block the serverless function until Vercel's default timeout (which varies by plan: 10s hobby, 60s pro, 300s enterprise). During that time, the function consumes resources and the user sees no feedback.

**Fix:**
```ts
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30_000) // 30s

const providerResponse = await fetch(url, {
  ...options,
  signal: controller.signal,
})
clearTimeout(timeoutId)
```

---

### 8. HIGH — Double Zod Validation Inside `$transaction`

**File:** `lib/events/transactional-ingestion-service.ts`

Inside every `$transaction`, the ingestion service runs two Zod schema validations:

```ts
return this.client.$transaction(async (tx) => {
  const { result, event } = await mutation(tx)
  
  canonicalHealthEventSchema.parse(event)      // Zod parse #1
  // ...build envelope...
  healthEventEnvelopeSchema.parse(envelope)    // Zod parse #2
  
  // ...append to event store + outbox...
})
```

Zod `.parse()` is synchronous CPU work happening inside a database transaction. This increases transaction hold time, which increases lock contention under concurrency.

**Fix options:**
- **Move validation before the transaction** (validate input, then transact).
- **Use `validate: false` option** where the input is already validated at the API boundary.
- **Use `safeParse` outside the transaction** and short-circuit before entering.

---

### 9. HIGH — Biomarker POST: ~15+ DB Operations End-to-End

A single `POST /api/biomarkers` request executes this pipeline:

```
Layer              DB Operations
─────────────────  ────────────────────────────────────────
Rate Limit         2-3 Redis calls (incr + pttl + pexpire)
Auth               1 (getServerSession → JWT decode, no DB usually)
Tenancy            1 (deriveTenantContextWithValidation → user.findUnique)
Idempotency        3-4 (reserveIdempotencyRecord: find + delete? + create)
Transaction        1 (biomarker.create)
Event Ingestion    2 (event store append + outbox create)
Zod Validation     - (CPU, but inside transaction)
Idempotency End    1 (update record with result)
Audit              4 (resolveUser + getLatestHash + create + update)
─────────────────  ────────────────────────────────────────
TOTAL              ~15-17 DB/Redis operations per biomarker POST
```

At 100 concurrent users, that's 1,500-1,700 DB operations per second just for biomarker creates. This will saturate a typical PostgreSQL connection pool quickly.

**Fix:** Combine the optimizations from items 1, 5, and 6 to reduce the per-mutation overhead to ~6-8 operations.

---

### 10. MEDIUM — Redis Rate Limit: 2-3 Network Round-Trips

**File:** `lib/rate-limit.ts`

```ts
const count = await this.redis.incr(namespacedKey)     // Round-trip 1
let ttlMs = await this.redis.pttl(namespacedKey)       // Round-trip 2

if (ttlMs < 0) {
  await this.redis.pexpire(namespacedKey, window)       // Round-trip 3
  ttlMs = window
}
```

**Fix:** Use a **Lua script** or **Redis pipeline** to execute all operations atomically in a single round-trip:

```ts
const script = `
  local count = redis.call('INCR', KEYS[1])
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
  end
  return {count, ttl}
`
```

---

### 11. MEDIUM — Tenant Validation: Extra DB Query Per Request

**File:** `lib/tenancy.ts`

`deriveTenantContextWithValidation()` calls `validateTenantMembership()` which does `db.user.findUnique()` with organization memberships on **every** request that uses header-based tenancy. This is separate from and in addition to the session lookup.

**Fix options:**
- **Embed tenant membership in the JWT token** so no DB call is needed.
- **Cache validated memberships** per user (short TTL, 30-60s).

---

### 12. MEDIUM — No Client-Side Debounce/Throttle

**Files:** Most client components in `components/`

Only `GlobalSearch` and `CompoundMixer` implement a 300ms `setTimeout`-based debounce. All other components fire fetches immediately on state change or mount:

- `BiomarkerTrends`, `BioAgeTimeline`, `BioAgeScoreCard`, `WearableConnect`, `ConsentCollection`, etc. — all fetch on mount without any deduplication.
- No `SWR`, `React Query`, or any data-fetching library with built-in deduplication and stale-while-revalidate.

**Fix:**
- Adopt **SWR or React Query** for all client-side data fetching (automatic deduplication, caching, revalidation).
- Add debounce to search/filter inputs that trigger API calls.

---

### 13. MEDIUM — CompoundMixer: N Parallel Fetch Calls

**File:** `components/compound-mixer.tsx`

On every selection change, the mixer fires one fetch per selected compound:

```ts
Promise.all(
  selected.map((c) =>
    fetch(`/api/knowledge-graph?compound=${c.id}`)
  )
)
```

Selecting 5 compounds fires 5 concurrent API calls. Each API call hits the database, pays rate-limiting overhead, and returns potentially overlapping data.

**Fix:**
- **Batch API:** Create `/api/knowledge-graph/batch?compounds=id1,id2,...` that returns all interactions in one query.
- **Client-side cache:** Cache results by compound ID so re-selections don't re-fetch.

---

### 14. MEDIUM — Zero Server-Side Caching

There are **no** uses of:
- `export const revalidate = ...` (ISR)
- `cache()` (React cache)
- `unstable_cache()` (Next.js data cache)

Every server component request (dashboard, admin pages) executes fresh database queries. Static or slow-changing data (pathway count, compound catalog, published articles) could be cached.

**Fix:**
- Add `unstable_cache` with appropriate TTL for read-heavy, slow-changing data.
- Use `export const revalidate = 60` on pages with mostly-static content.

---

### 15. MEDIUM — Admin FL Page: Sequential Waterfall

**File:** `app/admin/fl/page.tsx`

```ts
const [...queries] = await Promise.all([...5 queries...])  // Parallel ✓
const totalEpsilonSpent = await db.fLParticipation.aggregate({...})  // Sequential ✗
```

The `aggregate()` call is independent and could be parallelized with the `Promise.all`.

**Fix:** Move the `aggregate` into the `Promise.all` array.

---

## Cost Model: Single Biomarker POST

```
┌──────────────────────────────────────────────────────────────────┐
│ Client: POST /api/biomarkers                                     │
├──────────────────────────────────────────────────────────────────┤
│ 1. Rate Limit         │ Redis: incr + pttl [+ pexpire]    (2-3) │
│ 2. Auth               │ JWT decode (no DB)                  (0)  │
│ 3. Zod parse payload  │ CPU only                            (0)  │
│ 4. Tenant validation  │ DB: user.findUnique + memberships   (1)  │
│ 5. Idempotency reserve│ DB: findUnique + [delete] + create (2-3) │
│ 6. $transaction       │                                          │
│    ├─ biomarker.create │ DB: INSERT                          (1) │
│    ├─ Zod parse x2     │ CPU (inside txn!)                   (0) │
│    ├─ event store      │ DB: INSERT                          (1) │
│    └─ outbox create    │ DB: INSERT                          (1) │
│ 7. Idempotency update │ DB: UPDATE                           (1) │
│ 8. Audit              │                                          │
│    ├─ resolveUser      │ DB: findUnique                      (1) │
│    ├─ getLatestHash    │ DB: findFirst(orderBy desc)         (1) │
│    ├─ auditLog.create  │ DB: INSERT                          (1) │
│    └─ auditLog.update  │ DB: UPDATE                          (1) │
├──────────────────────────────────────────────────────────────────┤
│ TOTAL                  │ ~13-15 DB + 2-3 Redis = ~15-17 ops     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Priority Remediation Roadmap

### Phase 1 — Immediate (High Impact, Low Effort)

1. **Add missing indexes** on `Biomarker` and `Protocol` models (+2 indexes each).
2. **Add `AbortController` + 30s timeout** to all external AI fetch calls.
3. **Move aggregate query into `Promise.all`** in admin FL page.
4. **Compute audit entry hash before insert** (collapse `create` + `update` into one query).

### Phase 2 — Short-term (High Impact, Moderate Effort)

5. **Replace `{ contains: q }` with PostgreSQL full-text search** using `$queryRaw`.
6. **Add pagination/limits** to account export or move to background job.
7. **Pipeline Redis rate-limit calls** into a single Lua script.
8. **Cache circuit breaker state** in-memory; only write to DB on state transitions.
9. **Move Zod validation outside the `$transaction`** boundary.

### Phase 3 — Medium-term (Structural Improvements)

10. **Collapse idempotency reserve** into a single `INSERT ... ON CONFLICT` operation.
11. **Embed tenant membership in JWT** to eliminate per-request DB lookups.
12. **Adopt SWR/React Query** for all client-side data fetching.
13. **Add `unstable_cache`** for slow-changing server-component data (pathway counts, compound catalog).
14. **Create batch knowledge-graph endpoint** for the CompoundMixer.

---

*Audit completed against codebase at current HEAD.*
