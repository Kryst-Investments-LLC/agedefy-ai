import { createEntity, deleteEntity, getEntity, listEntity, updateEntity } from "@/scientist-sponsor-marketplace/backend/controllers/entityController"
import { getMatchRecommendations } from "@/scientist-sponsor-marketplace/backend/controllers/matchingController"
import { getWorkspaceSnapshot } from "@/scientist-sponsor-marketplace/backend/controllers/workspaceController"
import { handleWorkflow } from "@/scientist-sponsor-marketplace/backend/controllers/workflowController"

export const marketplaceApiHandlers = {
  listEntity,
  createEntity,
  getEntity,
  updateEntity,
  deleteEntity,
  getWorkspaceSnapshot,
  getMatchRecommendations,
  handleWorkflow,
} as const

export {
  createEntity,
  deleteEntity,
  getEntity,
  getMatchRecommendations,
  getWorkspaceSnapshot,
  handleWorkflow,
  listEntity,
  updateEntity,
}
