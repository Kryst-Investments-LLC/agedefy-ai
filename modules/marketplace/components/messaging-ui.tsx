"use client"

import { useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useMarketplaceEntity } from "@/modules/marketplace/hooks/use-marketplace-entity"
import { useMarketplaceWorkspace } from "@/modules/marketplace/hooks/use-marketplace-workspace"

export function MessagingUI() {
  const { snapshot, actingAs, refresh } = useMarketplaceWorkspace()
  const { runWorkflow, submitting } = useMarketplaceEntity(actingAs)
  const [selectedDealRoomId, setSelectedDealRoomId] = useState(snapshot.dealRooms[0]?.id ?? "")
  const [body, setBody] = useState("Shared diligence package uploaded. Please review the latest evidence bundle.")

  const activeDealRoom = useMemo(
    () => snapshot.dealRooms.find((dealRoom) => dealRoom.id === selectedDealRoomId) ?? snapshot.dealRooms[0] ?? null,
    [selectedDealRoomId, snapshot.dealRooms],
  )

  const messages = useMemo(
    () => snapshot.messages.filter((message) => message.dealRoomId === activeDealRoom?.id),
    [activeDealRoom?.id, snapshot.messages],
  )

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeDealRoom) {
      return
    }

    await runWorkflow("deal", {
      action: "message",
      dealRoomId: activeDealRoom.id,
      body,
    })
    setBody("")
    await refresh()
  }

  return (
    <Card className="border-white/10 bg-slate-950/80 text-white">
      <CardHeader>
        <CardTitle>Messaging UI</CardTitle>
        <CardDescription className="text-white/60">Coordinate diligence, agreement review, and payment milestones inside each deal room.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          {snapshot.dealRooms.length ? snapshot.dealRooms.map((dealRoom) => (
            <button
              key={dealRoom.id}
              type="button"
              className={`w-full rounded-2xl border p-4 text-left transition ${dealRoom.id === activeDealRoom?.id ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              onClick={() => setSelectedDealRoomId(dealRoom.id)}
            >
              <p className="font-medium text-white">{dealRoom.status.toLowerCase()} · {dealRoom.agreementStatus.toLowerCase()}</p>
              <p className="mt-1 text-sm text-white/50">Updated {new Date(dealRoom.updatedAt).toLocaleString()}</p>
            </button>
          )) : <p className="text-sm text-white/55">No deal rooms are available yet.</p>}
        </div>

        <div className="space-y-4">
          <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-white">{message.senderRole}</p>
                  <p className="text-xs text-white/45">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-2 text-sm text-white/70">{message.body}</p>
              </div>
            )) : <p className="text-sm text-white/55">Messages will appear here once diligence starts.</p>}
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            <Textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write an update, diligence request, or agreement note." />
            <Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={submitting || !activeDealRoom}>Send message</Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
