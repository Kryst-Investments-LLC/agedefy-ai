import { getWorkspaceSnapshot } from "@/scientist-sponsor-marketplace/backend/controllers/workspaceController"

export async function GET(request: Request) {
  const url = new URL(request.url)
  return getWorkspaceSnapshot(url.searchParams.get("actingAsRole") ?? undefined)
}
