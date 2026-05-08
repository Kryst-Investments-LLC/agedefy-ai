"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"

import { Button } from "@/components/ui/button"

export function AccountDataActions() {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportData = async () => {
    setExporting(true)
    setError(null)
    try {
      const response = await fetch("/api/account/export")
      if (!response.ok) throw new Error("Export failed")
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `biozephyra-data-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? "Deletion failed")
      }
      await signOut({ callbackUrl: "/" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed")
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
      <h2 className="text-lg font-semibold">Data & privacy</h2>
      <p className="mt-2 text-sm text-gray-400">
        Export all your data as JSON or permanently delete your account. These actions support GDPR data subject rights.
      </p>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={exportData} disabled={exporting}>
          {exporting ? "Exporting..." : "Export my data"}
        </Button>
        {!confirmDelete ? (
          <Button variant="outline" className="border-red-800 text-red-400 hover:bg-red-950" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        ) : (
          <Button variant="destructive" className="bg-red-700 hover:bg-red-800" onClick={deleteAccount} disabled={deleting}>
            {deleting ? "Deleting..." : "Confirm permanent deletion"}
          </Button>
        )}
      </div>
    </div>
  )
}
