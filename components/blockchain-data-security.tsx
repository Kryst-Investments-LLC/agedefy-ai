"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Lock, Key, Database, CheckCircle, AlertTriangle, Coins, Users } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function BlockchainDataSecurity() {
  const { t } = useTranslation()
  const [walletConnected, setWalletConnected] = useState(false)

  const securityFeatures = [
    {
      name: "Encrypted Health Records",
      description: "Your health data is encrypted and stored on blockchain",
      status: "active",
      encryption: "AES-256",
      lastUpdate: "2024-12-20"
    },
    {
      name: "Decentralized Identity",
      description: "Self-sovereign identity management",
      status: "active",
      encryption: "Ed25519",
      lastUpdate: "2024-12-19"
    },
    {
      name: "Smart Contract Access",
      description: "Automated access control via smart contracts",
      status: "pending",
      encryption: "Multi-sig",
      lastUpdate: "2024-12-18"
    },
    {
      name: "Data Monetization",
      description: "Earn tokens by sharing anonymized health data",
      status: "available",
      encryption: "Zero-knowledge",
      lastUpdate: "2024-12-17"
    }
  ]

  const dataAssets = [
    {
      type: "Biomarker Data",
      size: "2.3 MB",
      value: "45 HEALTH tokens",
      buyers: 12,
      privacy: "Anonymized"
    },
    {
      type: "Genetic Variants",
      size: "890 KB",
      value: "120 HEALTH tokens",
      buyers: 8,
      privacy: "Zero-knowledge"
    },
    {
      type: "Lifestyle Patterns",
      size: "1.7 MB",
      value: "30 HEALTH tokens",
      buyers: 15,
      privacy: "Aggregated"
    },
    {
      type: "Exercise Data",
      size: "5.1 MB",
      value: "25 HEALTH tokens",
      buyers: 20,
      privacy: "Anonymized"
    }
  ]

  const accessLogs = [
    {
      entity: "Longevity Research Institute",
      dataType: "Biomarker trends",
      timestamp: "2024-12-20 14:30",
      permission: "Read-only",
      compensation: "15 HEALTH"
    },
    {
      entity: "Pharmaceutical Company X",
      dataType: "Drug interaction data",
      timestamp: "2024-12-20 09:15",
      permission: "Aggregated",
      compensation: "50 HEALTH"
    },
    {
      entity: "Academic Research Team",
      dataType: "Sleep patterns",
      timestamp: "2024-12-19 16:45",
      permission: "Anonymized",
      compensation: "8 HEALTH"
    }
  ]

  const walletStats = {
    totalEarned: 1247,
    currentBalance: 892,
    dataShares: 156,
    privacyScore: 98
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400"
      case "pending": return "text-yellow-400"
      case "available": return "text-blue-400"
      default: return "text-gray-400"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "pending": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "available": return "bg-blue-600/20 text-blue-300 border-blue-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Blockchain Data Security</h2>
        <p className="text-gray-400">Own your health data and earn from secure sharing</p>
      </div>

      <Tabs defaultValue="security" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="security" className="text-gray-300">Security Features</TabsTrigger>
          <TabsTrigger value="data-assets" className="text-gray-300">Data Assets</TabsTrigger>
          <TabsTrigger value="access-control" className="text-gray-300">Access Control</TabsTrigger>
          <TabsTrigger value="wallet" className="text-gray-300">Wallet & Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {securityFeatures.map((feature, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-400" />
                      {feature.name}
                    </CardTitle>
                    <Badge className={getStatusBadge(feature.status)}>
                      {feature.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Encryption</span>
                      <span className="text-white">{feature.encryption}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Update</span>
                      <span className="text-white">{feature.lastUpdate}</span>
                    </div>
                    <Button 
                      variant={feature.status === "active" ? "outline" : "default"}
                      className="w-full"
                    >
                      {feature.status === "active" ? "Manage" : feature.status === "pending" ? "Activate" : "Enable"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data-assets" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataAssets.map((asset, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-green-400" />
                    {asset.type}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Size</span>
                      <span className="text-white">{asset.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Market Value</span>
                      <span className="text-green-400 font-bold">{asset.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Interested Buyers</span>
                      <span className="text-white">{asset.buyers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Privacy Level</span>
                      <Badge variant="secondary">{asset.privacy}</Badge>
                    </div>
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      <Coins className="h-4 w-4 mr-2" />
                      List for Sale
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="access-control" className="space-y-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Access Requests</CardTitle>
              <CardDescription className="text-gray-400">
                Organizations that have accessed your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accessLogs.map((log, index) => (
                  <div key={index} className="p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium">{log.entity}</h4>
                      <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
                        +{log.compensation}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Data Type: </span>
                        <span className="text-white">{log.dataType}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Permission: </span>
                        <span className="text-white">{log.permission}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Time: </span>
                        <span className="text-white">{log.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Coins className="h-5 w-5 text-yellow-400" />
                  Total Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {walletStats.totalEarned} HEALTH
                </div>
                <p className="text-gray-400 text-sm">Lifetime earnings</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-400" />
                  Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">
                  {walletStats.currentBalance} HEALTH
                </div>
                <p className="text-gray-400 text-sm">Available to withdraw</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  Data Shares
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">
                  {walletStats.dataShares}
                </div>
                <p className="text-gray-400 text-sm">Successful transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-400" />
                  Privacy Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {walletStats.privacyScore}%
                </div>
                <p className="text-gray-400 text-sm">Data protection level</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Wallet Management</CardTitle>
              <CardDescription className="text-gray-400">
                Connect your Web3 wallet to manage earnings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!walletConnected ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">Connect your wallet to start earning</p>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setWalletConnected(true)}
                  >
                    Connect Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-green-400">Wallet Connected: 0x1234...5678</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button className="bg-green-600 hover:bg-green-700">
                      Withdraw Earnings
                    </Button>
                    <Button variant="outline">
                      View Transaction History
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
