import type { Prisma } from "@prisma/client"

import { serializeForJson } from "@/scientist-sponsor-marketplace/shared/utils"

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return serializeForJson(value) as Prisma.InputJsonValue
}

export function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return serializeForJson(value) as Prisma.InputJsonObject
}
