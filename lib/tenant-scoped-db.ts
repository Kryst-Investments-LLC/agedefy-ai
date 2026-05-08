import type { PrismaClient } from "@prisma/client"

import { db } from "@/lib/db"

/**
 * Returns a thin helper that automatically injects `userId` and optional
 * `tenantId` WHERE clauses into common Prisma query patterns.
 *
 * Usage in an API route:
 *   const scoped = scopedDb(session.user.id, session.user.tenantId)
 *   const rows = await scoped.findMany("biomarker", { where: { name: "LDL" } })
 */

type WhereClause = Record<string, unknown>
type ScopedFindManyArgs = {
  where?: WhereClause
  [key: string]: unknown
}
type ScopedFindFirstArgs = ScopedFindManyArgs
type ScopedCreateArgs = { data: Record<string, unknown>; [key: string]: unknown }

function injectScope(
  where: WhereClause | undefined,
  userId: string,
  tenantId?: string,
): WhereClause {
  const scope: WhereClause = { ...where, userId }
  if (tenantId) {
    scope.tenantId = tenantId
  }
  return scope
}

function injectScopeIntoData(
  data: Record<string, unknown>,
  userId: string,
  tenantId?: string,
): Record<string, unknown> {
  const scoped: Record<string, unknown> = { ...data, userId }
  if (tenantId && !("tenantId" in data)) {
    scoped.tenantId = tenantId
  }
  return scoped
}

export function scopedDb(userId: string, tenantId?: string) {
  return {
    /**
     * Find many records, auto-injecting userId (and tenantId when the model has it).
     * @param model Prisma model delegate name (e.g. "biomarker")
     * @param args Standard Prisma findMany args; userId is always added to `where`.
     */
    async findMany<T = unknown>(
      model: keyof PrismaClient,
      args: ScopedFindManyArgs = {},
    ): Promise<T[]> {
      const delegate = (db as unknown as Record<string, unknown>)[model as string] as Record<string, (...args: unknown[]) => unknown> | undefined
      if (!delegate?.findMany) {
        throw new Error(`Model "${String(model)}" does not support findMany`)
      }
      return delegate.findMany({
        ...args,
        where: injectScope(args.where, userId, tenantId),
      }) as Promise<T[]>
    },

    async findFirst<T = unknown>(
      model: keyof PrismaClient,
      args: ScopedFindFirstArgs = {},
    ): Promise<T | null> {
      const delegate = (db as unknown as Record<string, unknown>)[model as string] as Record<string, (...args: unknown[]) => unknown> | undefined
      if (!delegate?.findFirst) {
        throw new Error(`Model "${String(model)}" does not support findFirst`)
      }
      return delegate.findFirst({
        ...args,
        where: injectScope(args.where, userId, tenantId),
      }) as Promise<T | null>
    },

    async create<T = unknown>(
      model: keyof PrismaClient,
      args: ScopedCreateArgs,
    ): Promise<T> {
      const delegate = (db as unknown as Record<string, unknown>)[model as string] as Record<string, (...args: unknown[]) => unknown> | undefined
      if (!delegate?.create) {
        throw new Error(`Model "${String(model)}" does not support create`)
      }
      return delegate.create({
        ...args,
        data: injectScopeIntoData(args.data, userId, tenantId),
      }) as Promise<T>
    },

    /**
     * Count with scoped where clause.
     */
    async count(
      model: keyof PrismaClient,
      args: ScopedFindManyArgs = {},
    ): Promise<number> {
      const delegate = (db as unknown as Record<string, unknown>)[model as string] as Record<string, (...args: unknown[]) => unknown> | undefined
      if (!delegate?.count) {
        throw new Error(`Model "${String(model)}" does not support count`)
      }
      return delegate.count({
        ...args,
        where: injectScope(args.where, userId, tenantId),
      }) as Promise<number>
    },

    /** Direct access to underlying userId and tenantId for custom queries. */
    userId,
    tenantId,
  }
}

/**
 * Asserts that a given record belongs to the expected tenant + user.
 * Throws if the record doesn't match, preventing cross-tenant data leakage.
 */
export function assertTenantOwnership(
  record: { userId?: string; tenantId?: string } | null,
  expectedUserId: string,
  expectedTenantId?: string,
): void {
  if (!record) {
    throw new TenantAccessError("Record not found")
  }
  if (record.userId && record.userId !== expectedUserId) {
    throw new TenantAccessError("User does not own this record")
  }
  if (expectedTenantId && record.tenantId && record.tenantId !== expectedTenantId) {
    throw new TenantAccessError("Record belongs to a different tenant")
  }
}

export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TenantAccessError"
  }
}
