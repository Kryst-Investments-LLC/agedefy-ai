"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"

interface UserRow {
  id: string
  name: string | null
  email: string
  role: string
  emailVerified: boolean
  createdAt: string
  biomarkerCount: number
  protocolCount: number
  labOrderCount: number
  subscriptionCount: number
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-600/20 text-red-700 dark:text-red-300 border-red-500/20",
  CLINICIAN: "bg-purple-600/20 text-purple-700 dark:text-purple-300 border-purple-500/20",
  RESEARCHER: "bg-blue-600/20 text-blue-700 dark:text-blue-300 border-blue-500/20",
  MEMBER: "bg-gray-600/20 text-muted-foreground border-gray-500/20",
}

export function AdminUserManagement({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(search.toLowerCase()))
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRole(userId)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      })
      if (res.ok) {
        window.location.reload()
      }
    } finally {
      setUpdatingRole(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">User Management</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">All roles</option>
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="CLINICIAN">Clinician</option>
          <option value="RESEARCHER">Researcher</option>
        </select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Verified</th>
              <th className="px-4 py-3 text-right font-medium">Bio</th>
              <th className="px-4 py-3 text-right font-medium">Proto</th>
              <th className="px-4 py-3 text-right font-medium">Labs</th>
              <th className="px-4 py-3 text-right font-medium">Subs</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((u) => (
              <tr key={u.id} className="bg-background hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{u.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge className={roleColors[u.role] || roleColors.MEMBER} variant="outline">
                    {u.role.toLowerCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {u.emailVerified ? (
                    <span className="text-green-600 dark:text-green-400">✓</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">{u.biomarkerCount}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{u.protocolCount}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{u.labOrderCount}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{u.subscriptionCount}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    disabled={updatingRole === u.id}
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="CLINICIAN">Clinician</option>
                    <option value="RESEARCHER">Researcher</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
