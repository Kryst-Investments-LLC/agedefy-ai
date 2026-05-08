import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const fundingRequestService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceFundingRequest",
  defaultOrderBy: { updatedAt: "desc" },
})
