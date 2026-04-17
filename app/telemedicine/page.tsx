"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Navigation } from "@/components/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { withJsonMutationHeaders } from "@/lib/client-idempotency"

interface Provider {
  id: string
  name: string
  credentials: string
  specialty: string
  bio: string | null
  licenseStates: string | null
  acceptingNew: boolean
}

interface Consultation {
  id: string
  type: string
  status: string
  reason: string
  notes: string | null
  scheduledAt: string | null
  createdAt: string
  provider: Provider | null
}

const consultationTypeLabels: Record<string, string> = {
  INITIAL: "Initial Consultation",
  FOLLOW_UP: "Follow-up",
  LAB_REVIEW: "Lab Review",
  PROTOCOL_REVIEW: "Protocol Review",
}

const statusColors: Record<string, string> = {
  REQUESTED: "bg-yellow-600/20 text-yellow-300 border-yellow-500/20",
  SCHEDULED: "bg-blue-600/20 text-blue-300 border-blue-500/20",
  IN_PROGRESS: "bg-teal-600/20 text-teal-300 border-teal-500/20",
  COMPLETED: "bg-green-600/20 text-green-300 border-green-500/20",
  CANCELED: "bg-gray-600/20 text-gray-300 border-gray-500/20",
}

export default function TelemedicinePage() {
  const { data: session } = useSession()
  const [providers, setProviders] = useState<Provider[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState("")
  const [consultType, setConsultType] = useState("INITIAL")
  const [reason, setReason] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const [provRes, consultRes] = await Promise.all([
          fetch("/api/telemedicine"),
          session ? fetch("/api/telemedicine/consultations") : Promise.resolve(null),
        ])
        if (provRes.ok) setProviders(await provRes.json())
        if (consultRes?.ok) setConsultations(await consultRes.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim() || reason.trim().length < 10) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/telemedicine", {
        ...withJsonMutationHeaders({
          method: "POST",
        }, `telemedicine-request-${selectedProvider || "unassigned"}`),
        body: JSON.stringify({
          providerId: selectedProvider || undefined,
          type: consultType,
          reason: reason.trim(),
        }),
      })
      if (res.ok) {
        const consultation = await res.json()
        setConsultations((prev) => [consultation, ...prev])
        setReason("")
        setShowForm(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Telemedicine</p>
          <h1 className="text-4xl font-bold">Longevity Physician Network</h1>
          <p className="mt-2 text-gray-400">
            Browse clinician consultation workflows for longevity medicine, hormone health, and preventive care. Clinical availability, appropriateness, and treatment decisions depend on licensure and physician judgment.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading providers…</div>
        ) : (
          <>
            {/* Provider Directory */}
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">Available Providers</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((provider) => {
                  let states: string[] = []
                  try { states = JSON.parse(provider.licenseStates || "[]") } catch { /* ignore */ }
                  return (
                    <Card key={provider.id} className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-white text-lg">{provider.name}</CardTitle>
                            <CardDescription className="text-teal-400">{provider.credentials}</CardDescription>
                          </div>
                          <Badge className="bg-green-600/20 text-green-300 border-green-500/20" variant="outline">
                            Accepting patients
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-gray-300 text-sm space-y-2">
                        <p><span className="text-gray-500">Specialty:</span> {provider.specialty}</p>
                        {provider.bio && <p>{provider.bio}</p>}
                        {states.length > 0 && (
                          <p><span className="text-gray-500">Licensed in:</span> {states.join(", ")}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Request Consultation */}
            {session ? (
              <section className="mb-10">
                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="rounded-lg bg-teal-600 px-6 py-3 font-medium text-white hover:bg-teal-500 transition-colors"
                  >
                    Request a consultation
                  </button>
                ) : (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">New Consultation Request</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Consultation type</label>
                          <select
                            value={consultType}
                            onChange={(e) => setConsultType(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white"
                          >
                            <option value="INITIAL">Initial Consultation</option>
                            <option value="FOLLOW_UP">Follow-up</option>
                            <option value="LAB_REVIEW">Lab Review</option>
                            <option value="PROTOCOL_REVIEW">Protocol Review</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Preferred provider (optional)</label>
                          <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white"
                          >
                            <option value="">No preference</option>
                            {providers.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Reason for visit (min 10 characters)</label>
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white resize-none"
                            placeholder="Describe what you'd like to discuss…"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="submit"
                            disabled={submitting || reason.trim().length < 10}
                            className="rounded-lg bg-teal-600 px-6 py-2 font-medium text-white hover:bg-teal-500 transition-colors disabled:opacity-50"
                          >
                            {submitting ? "Submitting…" : "Submit request"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="rounded-lg border border-gray-600 px-6 py-2 text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </section>
            ) : (
              <section className="mb-10">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="py-6 text-center text-gray-400">
                    <a href="/sign-in" className="text-teal-400 hover:underline">Sign in</a> to request a consultation.
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Consultation History */}
            {consultations.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4">Your Consultations</h2>
                <div className="space-y-3">
                  {consultations.map((c) => (
                    <Card key={c.id} className="bg-gray-800 border-gray-700">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {consultationTypeLabels[c.type] || c.type}
                              {c.provider && <span className="text-gray-400 font-normal"> with {c.provider.name}</span>}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">{c.reason}</p>
                            <p className="text-xs text-gray-500 mt-2">Requested {new Date(c.createdAt).toLocaleDateString()}</p>
                          </div>
                          <Badge className={statusColors[c.status] || statusColors.REQUESTED} variant="outline">
                            {c.status.toLowerCase().replace("_", " ")}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
