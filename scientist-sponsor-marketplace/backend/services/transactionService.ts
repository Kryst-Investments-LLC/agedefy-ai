import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const transactionService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceTransaction",
  defaultOrderBy: { createdAt: "desc" },
})
