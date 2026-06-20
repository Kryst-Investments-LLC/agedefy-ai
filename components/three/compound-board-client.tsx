"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

import type { BoardCompound } from "./compound-board-3d"

const CompoundBoard3D = dynamic(
  () => import("./compound-board-3d").then((m) => m.CompoundBoard3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-lg bg-[#0b1020]">
        <p className="animate-pulse text-sm text-gray-400">Loading interactive board…</p>
      </div>
    ),
  },
)

export function CompoundBoardClient({ compounds }: { compounds: BoardCompound[] }) {
  const router = useRouter()
  return (
    <CompoundBoard3D
      compounds={compounds}
      onSelect={(id) => router.push(`/compounds/${id}`)}
    />
  )
}
