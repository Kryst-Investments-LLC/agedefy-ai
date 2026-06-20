"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { withJsonMutationHeaders } from "@/lib/client-idempotency"

interface Product {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  priceCents: number
  inStock: boolean
  thirdPartyTested: boolean
}

interface OrderItem {
  id: string
  quantity: number
  priceCents: number
  product: Product
}

interface Order {
  id: string
  status: string
  totalCents: number
  orderedAt: string
  items: OrderItem[]
}

const categoryLabels: Record<string, string> = {
  SUPPLEMENT: "Supplement",
  PEPTIDE: "Peptide",
  TEST_KIT: "Test Kit",
  DEVICE: "Device",
  BUNDLE: "Bundle",
}

const orderStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-600/20 text-yellow-300 border-yellow-500/20",
  PAID: "bg-blue-600/20 text-blue-300 border-blue-500/20",
  SHIPPED: "bg-teal-600/20 text-teal-300 border-teal-500/20",
  DELIVERED: "bg-green-600/20 text-green-300 border-green-500/20",
  CANCELED: "bg-gray-600/20 text-gray-300 border-gray-500/20",
  REFUNDED: "bg-red-600/20 text-red-300 border-red-500/20",
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function MarketplacePage() {
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [ordering, setOrdering] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const url = filter ? `/api/marketplace?category=${filter}` : "/api/marketplace"
        const [prodRes, ordRes] = await Promise.all([
          fetch(url),
          session ? fetch("/api/marketplace/orders") : Promise.resolve(null),
        ])
        if (prodRes.ok) {
          const data = await prodRes.json()
          // /api/marketplace returns { items, nextCursor } — not a bare array.
          setProducts(Array.isArray(data) ? data : data.items ?? [])
        }
        if (ordRes?.ok) {
          const data = await ordRes.json()
          setOrders(Array.isArray(data) ? data : data.items ?? data.orders ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session, filter])

  async function handleOrder(product: Product) {
    if (!session) return
    setOrdering(product.id)
    try {
      const res = await fetch("/api/marketplace/orders", {
        ...withJsonMutationHeaders({
          method: "POST",
        }, `marketplace-order-${product.id}`),
        body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }] }),
      })
      if (res.ok) {
        const order = await res.json()
        setOrders((prev) => [order, ...prev])
      }
    } finally {
      setOrdering(null)
    }
  }

  const categories = ["", "SUPPLEMENT", "PEPTIDE", "TEST_KIT", "DEVICE", "BUNDLE"]

  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="mx-auto max-w-5xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Marketplace</p>
          <h1 className="text-4xl font-bold">Longevity Products</h1>
          <p className="mt-2 text-gray-400">
            Curated supplements, test kits, and bundles from verified suppliers. Every product is backed by real inventory and third-party testing data.
          </p>
        </div>

        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                filter === cat
                  ? "bg-teal-600 text-white"
                  : "border border-gray-600 text-gray-300 hover:bg-gray-800"
              }`}
            >
              {cat ? categoryLabels[cat] || cat : "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading products…</div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-10">
              {products.map((product) => (
                <Card key={product.id} className="bg-gray-800 border-gray-700 flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Badge className="bg-gray-600/20 text-gray-300 border-gray-500/20" variant="outline">
                        {categoryLabels[product.category] || product.category}
                      </Badge>
                      {product.thirdPartyTested && (
                        <Badge className="bg-green-600/20 text-green-300 border-green-500/20" variant="outline">
                          3rd-party tested
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-white text-lg mt-2">{product.name}</CardTitle>
                    <CardDescription className="text-gray-400 text-sm">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-semibold text-teal-400">{formatPrice(product.priceCents)}</span>
                      {session ? (
                        <button
                          onClick={() => handleOrder(product)}
                          disabled={ordering === product.id}
                          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors disabled:opacity-50"
                        >
                          {ordering === product.id ? "Ordering…" : "Order now"}
                        </button>
                      ) : (
                        <a href="/sign-in" className="text-sm text-teal-400 hover:underline">Sign in to order</a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {products.length === 0 && (
                <p className="text-gray-500 col-span-full text-center py-10">No products matching this filter.</p>
              )}
            </div>

            {/* Order History */}
            {orders.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4">Your Orders</h2>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <Card key={order.id} className="bg-gray-800 border-gray-700">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {order.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Total: {formatPrice(order.totalCents)} • Ordered {new Date(order.orderedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={orderStatusColors[order.status] || orderStatusColors.PENDING} variant="outline">
                            {order.status.toLowerCase()}
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
    </AppShell>
  )
}
