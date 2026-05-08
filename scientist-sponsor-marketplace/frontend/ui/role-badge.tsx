import { Badge } from "@/components/ui/badge"
import type { MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

const roleClasses: Record<MarketplaceRole, string> = {
  scientist: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  sponsor: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  reviewer: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  admin: "bg-rose-500/15 text-rose-200 border-rose-500/30",
}

export function RoleBadge({ role }: { role: MarketplaceRole }) {
  return (
    <Badge variant="outline" className={roleClasses[role]}>
      {role}
    </Badge>
  )
}
