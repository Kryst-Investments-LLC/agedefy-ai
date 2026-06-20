/**
 * Moat / Tier DB integration pass.
 *
 * Unlike the unit tests (which mock `@/lib/db`), this suite runs the moat and
 * Tier code paths against a REAL Postgres database with seeded data. Its job is
 * to catch schema-mismatch runtime bugs — wrong table names, wrong columns,
 * wrong relations — that mocked tests cannot see (the kind that shipped as
 * `db.biomarkerRecord`).
 *
 * Requires a PostgreSQL DATABASE_URL; the vitest global-setup applies the schema
 * via `prisma db push`/`migrate deploy`. When DATABASE_URL is not Postgres the
 * suite is skipped.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { parseCohortDsl } from "@/lib/researcher/cohort-dsl-parser"
import { executeCohortQuery } from "@/lib/researcher/cohort-query-executor"
import { deductPrivacyBudget, getPrivacyBudget } from "@/lib/privacy/dp-engine"
import { fitPkProfile, getPkProfile } from "@/lib/agents/pk-fitter"
import { sweepExpiredPredictions } from "@/lib/loop/prediction-log-sweeper"
import { generateCycleReport } from "@/lib/reports/cycle-report"

const isPg = (process.env.DATABASE_URL ?? "").startsWith("postgres")
const d = isPg ? describe : describe.skip

const TENANT = "itest-moat"
const RESEARCHER_ID = `${TENANT}-researcher`
const COHORT_USERS = 55 // > K_ANON_MIN (50)

async function cleanup() {
  // Children first / cascade via user delete where possible.
  await db.clinicianCoSign.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.userPkProfile.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.userPrivacyBudget.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.twinSimulationRun.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.physiologicalTwin.deleteMany({ where: { userId: { startsWith: TENANT } } }).catch(() => {})
  await db.protocolOutcome.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.loopCycle.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.protocol.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  await db.auditLog.deleteMany({ where: { tenantId: TENANT } }).catch(() => {})
  // Deleting users cascades Biomarker + UserConsentGrant (onDelete: Cascade).
  await db.user.deleteMany({ where: { email: { startsWith: `${TENANT}-` } } }).catch(() => {})
}

d("moat/Tier DB integration", () => {
  beforeAll(async () => {
    await cleanup()

    // ── Researcher (runs cohort queries; needs a privacy budget) ────────────
    await db.user.create({
      data: {
        id: RESEARCHER_ID,
        email: `${TENANT}-researcher@example.com`,
        passwordHash: "x",
      },
    })

    // ── 55 consented users, each with a CRP biomarker < 3.0 ────────────────
    for (let i = 0; i < COHORT_USERS; i++) {
      const uid = `${TENANT}-u${i}`
      await db.user.create({
        data: {
          id: uid,
          email: `${TENANT}-u${i}@example.com`,
          passwordHash: "x",
          consentGrant: { create: { tenantId: TENANT, status: "active", scopes: {} } },
          biomarkers: {
            create: { tenantId: TENANT, name: "crp", value: 1.0 + (i % 5) * 0.2, unit: "mg/L" },
          },
        },
      })
    }
  }, 60_000)

  afterAll(async () => {
    await cleanup()
  })

  // ── M3: cohort DSL → real Biomarker query + DP + budget + audit ───────────
  it("executeCohortQuery runs against real Biomarker rows and returns DP aggregates", async () => {
    const query = parseCohortDsl(
      "COHORT WHERE biomarkers.crp.mean < 3.0 RETURN AGG.mean(biomarkers.crp), AGG.count()",
    )
    const res = await executeCohortQuery(RESEARCHER_ID, query, TENANT)

    expect(res.cohortSize).toBeGreaterThanOrEqual(50)
    expect(res.suppressedBelowKAnonymity).toBe(false)
    expect(res.result).not.toBeNull()
    expect(typeof res.result!.count).toBe("number")
    expect(res.epsilonConsumed).toBeGreaterThan(0)
  })

  // ── M1: privacy budget deduct/read against real UserPrivacyBudget ─────────
  it("deductPrivacyBudget + getPrivacyBudget persist and accumulate", async () => {
    const uid = `${TENANT}-budget`
    await db.user.create({
      data: { id: uid, email: `${TENANT}-budget@example.com`, passwordHash: "x" },
    })

    const first = await deductPrivacyBudget(uid, 0.5, TENANT)
    expect(first.epsilonUsed).toBeCloseTo(0.5)
    expect(first.queryCount).toBe(1)

    const second = await deductPrivacyBudget(uid, 0.5, TENANT)
    expect(second.epsilonUsed).toBeCloseTo(1.0)

    const read = await getPrivacyBudget(uid)
    expect(read?.epsilonUsed).toBeCloseTo(1.0)
    expect(read?.queryCount).toBe(2)
  })

  // ── Tier 5: PK fit reads ProtocolOutcome, upserts UserPkProfile ───────────
  it("fitPkProfile reads outcomes and upserts a profile", async () => {
    const uid = `${TENANT}-pk`
    await db.user.create({
      data: { id: uid, email: `${TENANT}-pk@example.com`, passwordHash: "x" },
    })
    const protocol = await db.protocol.create({
      data: { tenantId: TENANT, userId: uid, name: "PK protocol", status: "active" },
    })
    // Two completed outcomes with observed deltas → enough to fit
    for (let i = 0; i < 2; i++) {
      const cycle = await db.loopCycle.create({
        data: { tenantId: TENANT, userId: uid, status: "COMPLETE", triggeredBy: "MANUAL" },
      })
      await db.protocolOutcome.create({
        data: {
          tenantId: TENANT,
          userId: uid,
          loopCycleId: cycle.id,
          protocolId: protocol.id,
          cycleStartDate: new Date(Date.now() - (28 - i) * 86400_000),
          cycleEndDate: new Date(),
          observedBiomarkers: [{ observedDelta: -1.2 - i * 0.3 }],
          reflectedAt: new Date(Date.now() - i * 1000),
        },
      })
    }

    const fitted = await fitPkProfile(uid, "rapamycin", TENANT)
    expect(fitted).not.toBeNull()
    expect(fitted!.vd).toBeGreaterThan(0)

    const read = await getPkProfile(uid, "rapamycin")
    expect(read.source).toBe("fitted")
  })

  // ── Tier 5: prediction sweeper reads TwinSimulationRun + Biomarker ────────
  it("sweepExpiredPredictions scores an expired run from a real biomarker", async () => {
    const uid = `${TENANT}-sweep`
    await db.user.create({
      data: {
        id: uid,
        email: `${TENANT}-sweep@example.com`,
        passwordHash: "x",
        biomarkers: { create: { tenantId: TENANT, name: "CRP_AUC", value: -1.4, unit: "au" } },
      },
    })
    const twin = await db.physiologicalTwin.create({
      data: {
        userId: uid,
        parameterJson: {},
        hallmarkJson: {},
        modelVersion: "test@1",
      },
    })
    await db.twinSimulationRun.create({
      data: {
        tenantId: TENANT,
        twinId: twin.id,
        userId: uid,
        intervention: "rapamycin",
        horizonDays: 28,
        endpoint: "CRP_AUC",
        predictedMean: -1.5,
        predictedSdLo: -2.0,
        predictedSdHi: -1.0,
        uncertaintyKind: "monte_carlo",
        inputsHash: "abc",
        modelVersion: "test@1",
        predictionExpiresAt: new Date(Date.now() - 86400_000), // expired
      },
    })

    const res = await sweepExpiredPredictions()
    expect(res.scored + res.skipped).toBeGreaterThanOrEqual(1)
  })

  // ── Tier 4: cycle report reads LoopCycle with includes ────────────────────
  it("generateCycleReport reads a real LoopCycle + outcome", async () => {
    const uid = `${TENANT}-cycle`
    await db.user.create({
      data: { id: uid, email: `${TENANT}-cycle@example.com`, passwordHash: "x" },
    })
    const cycle = await db.loopCycle.create({
      data: { tenantId: TENANT, userId: uid, status: "COMPLETE", triggeredBy: "MANUAL", completedAt: new Date() },
    })
    await db.protocolOutcome.create({
      data: {
        tenantId: TENANT,
        userId: uid,
        loopCycleId: cycle.id,
        cycleStartDate: new Date(Date.now() - 28 * 86400_000),
        cycleEndDate: new Date(),
        targetBiomarkers: [{ name: "crp", predictedDelta: -1, predictedDirection: "down" }],
        observedBiomarkers: [{ name: "crp", observedDelta: -1.1, observedDirection: "down" }],
        overallEfficacy: 0.7,
      },
    })

    const report = await generateCycleReport(cycle.id)
    expect(report).not.toBeNull()
    expect(report!.loopCycleId).toBe(cycle.id)
    expect(report!.cycleStartedAt).toBeTruthy()
  })

  // ── M7: clinician co-sign DB write ────────────────────────────────────────
  it("clinicianCoSign create persists a co-sign record", async () => {
    const cid = `${TENANT}-clin`
    await db.user.create({
      data: { id: cid, email: `${TENANT}-clin@example.com`, passwordHash: "x" },
    })
    const rec = await db.clinicianCoSign.create({
      data: {
        tenantId: TENANT,
        resourceType: "DosageSuggestion",
        resourceId: "res-1",
        clinicianId: cid,
        signature: "deadbeef",
        jurisdiction: "US",
        licenseNumber: "1234567890",
      },
    })
    expect(rec.id).toBeTruthy()
  })
})
