"use client"

import {
  ShoppingCart,
  Star,
  Shield,
  Truck,
  CheckCircle,
  Search,
  Filter,
  Award,
  Beaker,
  Package,
  CreditCard,
} from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const products = [
  {
    id: 1,
    name: "Premium NMN (Nicotinamide Mononucleotide)",
    brand: "Longevity Labs",
    price: 89.99,
    originalPrice: 109.99,
    rating: 4.8,
    reviews: 1247,
    dosage: "250mg",
    servings: 60,
    image: "/placeholder.svg?height=200&width=200",
    verified: true,
    thirdPartyTested: true,
    purity: "99.5%",
    features: ["Third-party tested", "GMP certified", "Sublingual tablets", "No fillers"],
    description: "High-purity NMN for NAD+ support and cellular energy optimization",
    inStock: true,
    fastShipping: true,
    category: "NAD+ Boosters",
  },
  {
    id: 2,
    name: "Quercetin + Bromelain Complex",
    brand: "Pure Longevity",
    price: 34.99,
    originalPrice: 44.99,
    rating: 4.7,
    reviews: 892,
    dosage: "500mg + 100mg",
    servings: 90,
    image: "/placeholder.svg?height=200&width=200",
    verified: true,
    thirdPartyTested: true,
    purity: "98.2%",
    features: ["Enhanced absorption", "Senolytic support", "Anti-inflammatory", "Vegan capsules"],
    description: "Powerful senolytic combination for cellular cleanup and inflammation support",
    inStock: true,
    fastShipping: true,
    category: "Senolytics",
  },
  {
    id: 3,
    name: "Liposomal Curcumin (Longvida)",
    brand: "Advanced Nutrients",
    price: 59.99,
    originalPrice: 74.99,
    rating: 4.9,
    reviews: 634,
    dosage: "400mg",
    servings: 60,
    image: "/placeholder.svg?height=200&width=200",
    verified: true,
    thirdPartyTested: true,
    purity: "95.8%",
    features: ["280x better absorption", "Crosses blood-brain barrier", "Patented formula", "Non-GMO"],
    description: "Highly bioavailable curcumin for brain health and anti-inflammatory support",
    inStock: false,
    fastShipping: false,
    category: "Anti-inflammatory",
  },
  {
    id: 4,
    name: "Spermidine Wheat Germ Extract",
    brand: "Longevity Science",
    price: 79.99,
    originalPrice: 89.99,
    rating: 4.6,
    reviews: 423,
    dosage: "1mg",
    servings: 60,
    image: "/placeholder.svg?height=200&width=200",
    verified: true,
    thirdPartyTested: true,
    purity: "99.1%",
    features: ["Natural source", "Autophagy support", "Cardiovascular health", "Standardized extract"],
    description: "Natural spermidine for autophagy induction and longevity support",
    inStock: true,
    fastShipping: true,
    category: "Autophagy",
  },
]

const cart = [
  { id: 1, name: "Premium NMN", quantity: 1, price: 89.99 },
  { id: 2, name: "Quercetin + Bromelain", quantity: 2, price: 34.99 },
]

export function Marketplace() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [cartItems, setCartItems] = useState(cart)

  const categories = ["All", "NAD+ Boosters", "Senolytics", "Anti-inflammatory", "Autophagy", "Antioxidants"]

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)

  const addToCart = (product: any) => {
    const existingItem = cartItems.find((item) => item.id === product.id)
    if (existingItem) {
      setCartItems(cartItems.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)))
    } else {
      setCartItems([
        ...cartItems,
        {
          id: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
        },
      ])
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Verified Longevity Marketplace</h1>
        <p className="text-gray-400 text-lg mb-4">Premium compounds with third-party testing and quality guarantees</p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Third-Party Tested
          </Badge>
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Award className="h-3 w-3 mr-1" />
            Quality Verified
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <Truck className="h-3 w-3 mr-1" />
            Fast Shipping
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Products */}
        <div className="lg:col-span-3">
          {/* Search and Filters */}
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white rounded px-3 py-2 text-sm"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="bg-gray-800 border-gray-700 hover:border-teal-500/50 transition-all duration-300"
              >
                <div className="relative">
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  {product.verified && (
                    <Badge className="absolute top-2 left-2 bg-green-600/20 text-green-300 border-green-500/20">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {!product.inStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-lg">
                      <Badge className="bg-red-600/20 text-red-300 border-red-500/20">Out of Stock</Badge>
                    </div>
                  )}
                </div>

                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-semibold text-lg mb-1">{product.name}</h3>
                      <p className="text-gray-400 text-sm">{product.brand}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 mb-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-white font-medium">{product.rating}</span>
                        <span className="text-gray-400 text-sm">({product.reviews})</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-3">{product.description}</p>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div>
                      <span className="text-gray-400">Dosage:</span>
                      <span className="text-white ml-1">{product.dosage}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Servings:</span>
                      <span className="text-white ml-1">{product.servings}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Purity:</span>
                      <span className="text-green-400 ml-1">{product.purity}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Category:</span>
                      <span className="text-teal-400 ml-1">{product.category}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {product.features.slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <span className="text-2xl font-bold text-white">${product.price}</span>
                      {product.originalPrice > product.price && (
                        <span className="text-gray-400 line-through ml-2">${product.originalPrice}</span>
                      )}
                    </div>
                    {product.fastShipping && (
                      <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
                        <Truck className="h-3 w-3 mr-1" />
                        Fast Ship
                      </Badge>
                    )}
                  </div>

                  <Button
                    onClick={() => addToCart(product)}
                    disabled={!product.inStock}
                    className={`w-full ${product.inStock ? "bg-teal-600 hover:bg-teal-700" : "bg-gray-600 cursor-not-allowed"}`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {product.inStock ? "Add to Cart" : "Out of Stock"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Shopping Cart Sidebar */}
        <div>
          <Card className="bg-gray-800 border-gray-700 sticky top-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Shopping Cart
                <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">{cartItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cartItems.length > 0 ? (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium text-sm">{item.name}</h4>
                        <span className="text-white font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Qty: {item.quantity}</span>
                        <span className="text-gray-400 text-sm">${item.price} each</span>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-gray-600 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-white font-semibold">Total:</span>
                      <span className="text-white font-bold text-lg">${cartTotal.toFixed(2)}</span>
                    </div>

                    <Alert className="border-green-500/20 bg-green-500/10 mb-4">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-200 text-sm">
                        Free shipping on orders over $75!
                      </AlertDescription>
                    </Alert>

                    <Button className="w-full bg-teal-600 hover:bg-teal-700 mb-2">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Checkout
                    </Button>

                    <div className="text-xs text-gray-500 text-center">Secure checkout • 30-day return policy</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Your cart is empty</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quality Assurance */}
          <Card className="bg-gray-800 border-gray-700 mt-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                Quality Assurance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">Third-party tested</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">GMP certified facilities</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">Purity certificates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">30-day money back</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
