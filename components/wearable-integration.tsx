"use client"

import {
  Smartphone,
  Watch,
  Activity,
  Heart,
  Moon,
  Zap,
  TrendingUp,
  Shield,
  CheckCircle,
  Bluetooth,
  Battery,
  FolderSyncIcon as Sync,
} from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const supportedDevices = [
  {
    id: "apple-watch",
    name: "Apple Watch",
    brand: "Apple",
    icon: Watch,
    connected: true,
    lastSync: "2 minutes ago",
    batteryLevel: 85,
    metrics: ["Heart Rate", "Sleep", "Activity", "HRV"],
    status: "connected",
  },
  {
    id: "fitbit",
    name: "Fitbit Sense 2",
    brand: "Fitbit",
    icon: Watch,
    connected: false,
    lastSync: "Never",
    batteryLevel: null,
    metrics: ["Heart Rate", "Sleep", "Stress", "Temperature"],
    status: "available",
  },
  {
    id: "oura",
    name: "Oura Ring",
    brand: "Oura",
    icon: Activity,
    connected: true,
    lastSync: "5 minutes ago",
    batteryLevel: 67,
    metrics: ["Sleep", "HRV", "Temperature", "Recovery"],
    status: "connected",
  },
  {
    id: "whoop",
    name: "WHOOP 4.0",
    brand: "WHOOP",
    icon: Activity,
    connected: false,
    lastSync: "Never",
    batteryLevel: null,
    metrics: ["HRV", "Recovery", "Strain", "Sleep"],
    status: "available",
  },
]

const healthMetrics = [
  {
    name: "Resting Heart Rate",
    value: 58,
    unit: "bpm",
    trend: "down",
    change: "-3%",
    target: 55,
    source: "Apple Watch",
    lastUpdated: "2 min ago",
  },
  {
    name: "HRV (RMSSD)",
    value: 42,
    unit: "ms",
    trend: "up",
    change: "+8%",
    target: 45,
    source: "Oura Ring",
    lastUpdated: "5 min ago",
  },
  {
    name: "Sleep Score",
    value: 85,
    unit: "/100",
    trend: "up",
    change: "+12%",
    target: 90,
    source: "Oura Ring",
    lastUpdated: "8 hours ago",
  },
  {
    name: "Recovery Score",
    value: 78,
    unit: "%",
    trend: "stable",
    change: "0%",
    target: 80,
    source: "Multiple",
    lastUpdated: "8 hours ago",
  },
]

export function WearableIntegration() {
  const [isConnecting, setIsConnecting] = useState<string | null>(null)

  const connectDevice = async (deviceId: string) => {
    setIsConnecting(deviceId)
    // Simulate connection process
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsConnecting(null)
    // Update device status would happen here
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-400" />
      case "down":
        return <TrendingUp className="h-4 w-4 text-red-400 rotate-180" />
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-400"
      case "available":
        return "text-gray-400"
      case "error":
        return "text-red-400"
      default:
        return "text-gray-400"
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Wearable Integration</h1>
        <p className="text-gray-400 text-lg mb-4">
          Connect your health devices for automatic biomarker tracking and personalized insights
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">
            <Bluetooth className="h-3 w-3 mr-1" />
            Auto Sync
          </Badge>
          <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Privacy Protected
          </Badge>
          <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">
            <Zap className="h-3 w-3 mr-1" />
            Real-time
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Device Management */}
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Connected Devices
              </CardTitle>
              <CardDescription>Manage your health tracking devices and sync preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supportedDevices.map((device) => {
                  const DeviceIcon = device.icon
                  const isDeviceConnecting = isConnecting === device.id

                  return (
                    <div key={device.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-gray-600 rounded-full p-2">
                            <DeviceIcon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{device.name}</h3>
                            <p className="text-gray-400 text-sm">{device.brand}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {device.connected && device.batteryLevel && (
                            <div className="flex items-center gap-1 text-sm text-gray-400">
                              <Battery className="h-4 w-4" />
                              <span>{device.batteryLevel}%</span>
                            </div>
                          )}

                          <Badge
                            className={`${device.connected ? "bg-green-600/20 text-green-300 border-green-500/20" : "bg-gray-600/20 text-gray-300 border-gray-500/20"}`}
                          >
                            {device.connected ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Connected
                              </>
                            ) : (
                              "Available"
                            )}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {device.metrics.map((metric, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-gray-600 text-gray-300 text-xs">
                            {metric}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">Last sync: {device.lastSync}</div>

                        {device.connected ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-600 text-gray-300 hover:bg-gray-600"
                            >
                              <Sync className="h-4 w-4 mr-1" />
                              Sync Now
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-300 hover:bg-red-600/10"
                            >
                              Disconnect
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={async () => connectDevice(device.id)}
                            disabled={isDeviceConnecting}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            {isDeviceConnecting ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Bluetooth className="h-4 w-4 mr-1" />
                                Connect
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Health Metrics */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Health Metrics
              </CardTitle>
              <CardDescription>Live data from your connected devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {healthMetrics.map((metric, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-white font-medium">{metric.name}</h4>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(metric.trend)}
                        <span
                          className={`text-sm font-medium ${metric.trend === "up" ? "text-green-400" : metric.trend === "down" ? "text-red-400" : "text-gray-400"}`}
                        >
                          {metric.change}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-bold text-white">{metric.value}</span>
                      <span className="text-gray-400 text-sm">{metric.unit}</span>
                    </div>

                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>
                        Target: {metric.target} {metric.unit}
                      </span>
                      <span>{metric.source}</span>
                    </div>

                    <Progress value={(metric.value / metric.target) * 100} className="w-full mb-2" />

                    <div className="text-xs text-gray-500">Updated {metric.lastUpdated}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Sync Status */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sync className="h-5 w-5" />
                Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Apple Watch</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Oura Ring</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Health App</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    <span className="text-yellow-400 text-sm">Pending</span>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-4 bg-teal-600 hover:bg-teal-700">
                <Sync className="h-4 w-4 mr-2" />
                Sync All Devices
              </Button>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-green-500/20 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-200 text-sm">
                    All health data is encrypted end-to-end and stored securely on your device.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Data Encryption</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Local Storage</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Anonymous Analytics</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                </div>

                <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                  Privacy Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  View Health Trends
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 justify-start"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Export Health Data
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 justify-start"
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Sleep Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
