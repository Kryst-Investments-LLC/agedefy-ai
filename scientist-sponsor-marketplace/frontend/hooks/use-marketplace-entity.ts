"use client"

import { useState } from "react"

import type { MarketplaceEntityName, MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

async function parseJson(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body
}

export function useMarketplaceEntity(actingAsRole: MarketplaceRole) {
  const [submitting, setSubmitting] = useState(false)

  async function create(entity: MarketplaceEntityName, payload: Record<string, unknown>) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/scientist-sponsor-marketplace/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, actingAsRole }),
      })
      return await parseJson(response)
    } finally {
      setSubmitting(false)
    }
  }

  async function update(entity: MarketplaceEntityName, id: string, payload: Record<string, unknown>) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/scientist-sponsor-marketplace/${entity}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, actingAsRole }),
      })
      return await parseJson(response)
    } finally {
      setSubmitting(false)
    }
  }

  async function runWorkflow(workflow: "scientist" | "sponsor" | "deal", payload: Record<string, unknown>) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/scientist-sponsor-marketplace/workflows/${workflow}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, actingAsRole }),
      })
      return await parseJson(response)
    } finally {
      setSubmitting(false)
    }
  }

  return { create, update, runWorkflow, submitting }
}
