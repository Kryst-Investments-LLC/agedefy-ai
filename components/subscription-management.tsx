"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CreditCard,
  TrendingUp,
  Settings,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Crown,
  Zap,
  Gift,
  DollarSign,
} from "lucide-react"

const currentSubscription = {
  plan: "Researcher",
  status: "active",
  price: 149,
  billingCycle: "monthly",
  nextBilling: "2025-01-20",
  daysLeft: 25,
  features: [
    "Unlimited compound mixing",
    "AI personalization",
    "Monthly telemedicine consultations",
    "Priority clinical trial access",
    "30% lab testing discount",
  ],
}

const usageStats = {
  compounds: { used: 47, limit: "unlimited" },
  research: { used: 234, limit: "unlimited" },
  consultations: { used: 1, limit: 3 },
  labTests: { used: 2, limit: "unlimited" },
}

const billingHistory = [
  { date: "2024-12-20", amount: 149, status: "paid", plan: "Researcher" },
  { date: "2024-11-20", amount: 149, status: "paid", plan: "Researcher" },
  { date: "2024-10-20", amount: 49, status: "paid", plan: "Optimizer" },
  { date: "2024-09-20", amount: 49, status: "paid", plan: "Optimizer" },
]

const availableUpgrades = [
  {
    plan: "Longevity Elite",
    price: 499,
    savings: "Save $50 first month",
    features: ["Unlimited consultations", "Dedicated physician", "Custom formulations", "24/7 support"],
    highlight: true,
  },
]

export function SubscriptionManagement() {
  const [showCancelFlow, setShowCancelFlow] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-600/20 text-green-300 border-green-500/20"
      case "cancelled":
        return "bg-red-600/20 text-red-300 border-red-500/20"
      case "past_due":
        return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Subscription Management</h1>
        <p className="text-gray-400">Manage your longevity optimization plan and billing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{currentSubscription.plan}</h3>
                  <Badge className={getStatusColor(currentSubscription.status)}>
                    {currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">${currentSubscription.price}</div>
                  <div className="text-gray-400">per {currentSubscription.billingCycle}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Next billing date</span>
                  <span className="text-white">{currentSubscription.nextBilling}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-300">Days remaining</span>
                  <span className="text-teal-400">{currentSubscription.daysLeft} days</span>
                </div>
                <Progress value={(currentSubscription.daysLeft / 30) * 100} className="w-full" />
              </div>

              <div className="mb-6">
                <h4 className="text-white font-medium mb-3">Plan Features:</h4>
                <div className="space-y-2">
                  {currentSubscription.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setShowUpgradeModal(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  <Settings className="h-4 w-4 mr-2" />
                  Modify Plan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelFlow(true)}
                  className="border-red-600 text-red-300 hover:bg-red-900/20"
                >
                  Cancel Plan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Compounds Mixed</span>
                    <span className="text-white">
                      {usageStats.compounds.used}
                      {usageStats.compounds.limit !== "unlimited" && ` / ${usageStats.compounds.limit}`}
                    </span>
                  </div>
                  {usageStats.compounds.limit !== "unlimited" ? (
                    <Progress value={(usageStats.compounds.used / Number.parseInt(usageStats.compounds.limit)) * 100} />
                  ) : (
                    <div className="text-teal-400 text-sm">Unlimited ✨</div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Research Papers</span>
                    <span className="text-white">
                      {usageStats.research.used}
                      {usageStats.research.limit !== "unlimited" && ` / ${usageStats.research.limit}`}
                    </span>
                  </div>
                  {usageStats.research.limit !== "unlimited" ? (
                    <Progress value={(usageStats.research.used / Number.parseInt(usageStats.research.limit)) * 100} />
                  ) : (
                    <div className="text-teal-400 text-sm">Unlimited ✨</div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Consultations</span>
                    <span className="text-white">
                      {usageStats.consultations.used} / {usageStats.consultations.limit}
                    </span>
                  </div>
                  <Progress value={(usageStats.consultations.used / usageStats.consultations.limit) * 100} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Lab Tests Ordered</span>
                    <span className="text-white">
                      {usageStats.labTests.used}
                      {usageStats.labTests.limit !== "unlimited" && ` / ${usageStats.labTests.limit}`}
                    </span>
                  </div>
                  {usageStats.labTests.limit !== "unlimited" ? (
                    <Progress value={(usageStats.labTests.used / Number.parseInt(usageStats.labTests.limit)) * 100} />
                  ) : (
                    <div className="text-teal-400 text-sm">Unlimited ✨</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {billingHistory.map((bill, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-3 border-b border-gray-700 last:border-0"
                  >
                    <div>
                      <div className="text-white font-medium">{bill.plan} Plan</div>
                      <div className="text-gray-400 text-sm">{bill.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">${bill.amount}</div>
                      <Badge className={getStatusColor(bill.status)}>{bill.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                </Button>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  View All History
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upgrade Opportunity */}
          <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Crown className="h-6 w-6 text-yellow-400" />
                <h3 className="text-white font-semibold">Upgrade to Elite</h3>
              </div>

              <p className="text-gray-300 text-sm mb-4">
                Get unlimited consultations, dedicated physician, and custom formulations
              </p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span className="text-gray-300">24/7 priority support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span className="text-gray-300">Custom supplement formulation</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span className="text-gray-300">Quarterly in-person visits</span>
                </div>
              </div>

              <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                <Gift className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                  VISA
                </div>
                <div>
                  <div className="text-white">•••• •••• •••• 4242</div>
                  <div className="text-gray-400 text-sm">Expires 12/27</div>
                </div>
              </div>

              <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Payment
              </Button>
            </CardContent>
          </Card>

          {/* Savings Summary */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Your Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Lab testing discount</span>
                  <span className="text-green-400">$180 saved</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Marketplace discount</span>
                  <span className="text-green-400">$67 saved</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Clinical trial access</span>
                  <span className="text-green-400">$2,500 value</span>
                </div>
                <div className="border-t border-gray-600 pt-3 flex justify-between font-semibold">
                  <span className="text-white">Total value this month</span>
                  <span className="text-green-400">$2,747</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Contact Support</Button>
                <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                  Billing FAQ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Flow Modal */}
      {showCancelFlow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-gray-800 border-gray-700 max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                Cancel Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-red-500/20 bg-red-500/10 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-200">
                  You'll lose access to all premium features at the end of your billing cycle (
                  {currentSubscription.nextBilling}).
                </AlertDescription>
              </Alert>

              <p className="text-gray-300 mb-6">
                Before you go, would you like to downgrade to our free Explorer plan instead? You'll keep access to
                basic features.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelFlow(false)}
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Keep Plan
                </Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700">Downgrade to Free</Button>
                <Button variant="outline" className="flex-1 border-red-600 text-red-300 hover:bg-red-900/20">
                  Cancel Completely
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
