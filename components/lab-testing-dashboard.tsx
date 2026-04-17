"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Microscope, Clock, DollarSign, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react"

type Panel = {
  id: string
  name: string
  category: string
  description: string | null
  biomarkers: string
  priceCents: number
  turnaroundDays: number
}

type LabResult = {
  id: string
  biomarkerName: string
  value: number
  unit: string
  refLow: number | null
  refHigh: number | null
  flag: string | null
}

type Order = {
  id: string
  status: string
  orderedAt: string
  completedAt: string | null
  panel: Panel
  results: LabResult[]
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-600/20 text-yellow-300 border-yellow-500/30",
  CONFIRMED: "bg-blue-600/20 text-blue-300 border-blue-500/30",
  COLLECTED: "bg-purple-600/20 text-purple-300 border-purple-500/30",
  PROCESSING: "bg-indigo-600/20 text-indigo-300 border-indigo-500/30",
  COMPLETED: "bg-green-600/20 text-green-300 border-green-500/30",
  CANCELED: "bg-gray-600/20 text-gray-400 border-gray-500/30",
}

const flagColors: Record<string, string> = {
  normal: "text-green-400",
  low: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
}

export function LabTestingDashboard() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"catalog" | "orders">("catalog")

  const loadData = useCallback(async () => {
    setLoading(true)
    const [panelRes, orderRes] = await Promise.all([
      fetch("/api/lab-testing"),
      fetch("/api/lab-testing/orders"),
    ])
    if (panelRes.ok) setPanels(await panelRes.json())
    if (orderRes.ok) setOrders(await orderRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleOrder = async (panelId: string) => {
    setOrdering(panelId)
    const res = await fetch("/api/lab-testing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId }),
    })
    if (res.ok) {
      await loadData()
      setActiveTab("orders")
    }
    setOrdering(null)
  }

  const categories = [...new Set(panels.map((p) => p.category))].sort()

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "catalog" ? "default" : "outline"}
          className={activeTab === "catalog" ? "bg-teal-600" : "border-gray-600 text-gray-300"}
          onClick={() => setActiveTab("catalog")}
        >
          <Microscope className="h-4 w-4 mr-2" />
          Test Catalog ({panels.length})
        </Button>
        <Button
          variant={activeTab === "orders" ? "default" : "outline"}
          className={activeTab === "orders" ? "bg-teal-600" : "border-gray-600 text-gray-300"}
          onClick={() => setActiveTab("orders")}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          My Orders ({orders.length})
        </Button>
      </div>

      {/* Catalog */}
      {activeTab === "catalog" && (
        <div className="space-y-8">
          {panels.length === 0 ? (
            <p className="text-gray-500 text-sm">No lab test panels available. Run the seed to populate.</p>
          ) : (
            categories.map((category) => {
              const group = panels.filter((p) => p.category === category)
              return (
                <section key={category}>
                  <h3 className="text-lg font-semibold text-teal-400 capitalize mb-3">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.map((panel) => {
                      const biomarkers: string[] = JSON.parse(panel.biomarkers)
                      return (
                        <Card key={panel.id} className="bg-gray-800/50 border-gray-700">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-white text-base flex items-start justify-between">
                              {panel.name}
                              <Badge variant="outline" className="text-xs ml-2 border-gray-600 text-gray-400 shrink-0">
                                {biomarkers.length} markers
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {panel.description && (
                              <p className="text-gray-400 text-xs">{panel.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {biomarkers.map((b) => (
                                <span key={b} className="text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded">
                                  {b}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center gap-4 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${(panel.priceCents / 100).toFixed(0)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {panel.turnaroundDays} days
                                </span>
                              </div>
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-xs"
                                onClick={() => handleOrder(panel.id)}
                                disabled={ordering === panel.id}
                              >
                                {ordering === panel.id ? "Ordering…" : "Order Test"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )
            })
          )}
        </div>
      )}

      {/* Orders */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders yet. Browse the catalog to order your first test.</p>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="bg-gray-800/50 border-gray-700">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-white font-medium">{order.panel.name}</h4>
                      <p className="text-gray-400 text-xs mt-1">
                        Ordered {new Date(order.orderedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[order.status] ?? "bg-gray-600/20 text-gray-400"}>
                        {order.status}
                      </Badge>
                      {order.results.length > 0 && (
                        <button
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className="text-gray-400 hover:text-white"
                        >
                          {expandedOrder === order.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedOrder === order.id && order.results.length > 0 && (
                    <div className="mt-4 border-t border-gray-700 pt-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 text-left">
                            <th className="pb-2">Biomarker</th>
                            <th className="pb-2">Value</th>
                            <th className="pb-2">Ref. Range</th>
                            <th className="pb-2">Flag</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          {order.results.map((r) => (
                            <tr key={r.id} className="border-t border-gray-800">
                              <td className="py-1.5">{r.biomarkerName}</td>
                              <td className="py-1.5">{r.value} {r.unit}</td>
                              <td className="py-1.5 text-gray-500">
                                {r.refLow != null && r.refHigh != null
                                  ? `${r.refLow}–${r.refHigh} ${r.unit}`
                                  : "—"}
                              </td>
                              <td className={`py-1.5 capitalize ${flagColors[r.flag ?? ""] ?? "text-gray-500"}`}>
                                {r.flag ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
