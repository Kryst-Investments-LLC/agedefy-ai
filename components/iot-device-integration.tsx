"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wifi, Smartphone, Watch, Home, Thermometer, Droplets, Wind, Battery, Signal } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function IoTDeviceIntegration() {
  const { t } = useTranslation()
  const [selectedDevice, setSelectedDevice] = useState("smart-scale")

  const connectedDevices = [
    {
      id: "smart-scale",
      name: "Smart Body Scale",
      type: "Health Monitor",
      brand: "Withings",
      status: "connected",
      battery: 85,
      lastSync: "2 min ago",
      metrics: ["Weight", "Body Fat %", "Muscle Mass", "BMI"],
      icon: Watch
    },
    {
      id: "air-quality",
      name: "Air Quality Monitor",
      type: "Environmental",
      brand: "Awair",
      status: "connected",
      battery: 92,
      lastSync: "5 min ago",
      metrics: ["PM2.5", "CO2", "VOCs", "Humidity"],
      icon: Wind
    },
    {
      id: "smart-mattress",
      name: "Sleep Tracking Mattress",
      type: "Sleep Monitor",
      brand: "Sleep Number",
      status: "connected",
      battery: null,
      lastSync: "1 min ago",
      metrics: ["Sleep Quality", "Heart Rate", "Breathing", "Movement"],
      icon: Home
    },
    {
      id: "water-bottle",
      name: "Smart Water Bottle",
      type: "Hydration",
      brand: "HidrateSpark",
      status: "disconnected",
      battery: 45,
      lastSync: "2 hours ago",
      metrics: ["Water Intake", "Temperature", "Hydration Goals"],
      icon: Droplets
    },
    {
      id: "smart-thermostat",
      name: "Smart Thermostat",
      type: "Environmental",
      brand: "Nest",
      status: "connected",
      battery: null,
      lastSync: "30 sec ago",
      metrics: ["Temperature", "Humidity", "Energy Usage"],
      icon: Thermometer
    }
  ]

  const realtimeData = [
    { metric: "Room Temperature", value: "22.5°C", status: "optimal", device: "Smart Thermostat" },
    { metric: "Air Quality Index", value: "45 AQI", status: "good", device: "Air Quality Monitor" },
    { metric: "Humidity Level", value: "48%", status: "optimal", device: "Air Quality Monitor" },
    { metric: "Sleep Score", value: "87/100", status: "excellent", device: "Smart Mattress" },
    { metric: "Daily Water Intake", value: "1.2L / 2.5L", status: "low", device: "Smart Water Bottle" },
    { metric: "Body Weight", value: "72.3 kg", status: "stable", device: "Smart Scale" }
  ]

  const automationRules = [
    {
      name: "Optimal Sleep Environment",
      trigger: "Bedtime detected",
      actions: ["Lower temperature to 19°C", "Dim lights", "Enable sleep mode"],
      status: "active"
    },
    {
      name: "Air Quality Alert",
      trigger: "PM2.5 > 50",
      actions: ["Send notification", "Activate air purifier", "Close smart windows"],
      status: "active"
    },
    {
      name: "Hydration Reminder",
      trigger: "Water intake < 500ml by noon",
      actions: ["Send reminder", "Flash water bottle LED", "Log in health app"],
      status: "active"
    },
    {
      name: "Exercise Recovery",
      trigger: "High intensity workout detected",
      actions: ["Increase room temperature", "Suggest protein intake", "Monitor HRV"],
      status: "inactive"
    }
  ]

  const deviceCategories = [
    { name: "Health Monitors", count: 2, icon: Watch },
    { name: "Environmental", count: 2, icon: Wind },
    { name: "Sleep & Recovery", count: 1, icon: Home },
    { name: "Nutrition", count: 1, icon: Droplets }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "text-green-400"
      case "disconnected": return "text-red-400"
      case "syncing": return "text-yellow-400"
      default: return "text-gray-400"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "disconnected": return "bg-red-600/20 text-red-300 border-red-500/20"
      case "syncing": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case "optimal": case "excellent": case "good": return "text-green-400"
      case "low": case "warning": return "text-yellow-400"
      case "critical": return "text-red-400"
      default: return "text-gray-400"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">IoT Device Integration</h2>
        <p className="text-gray-400">Connect and monitor your smart health ecosystem</p>
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="devices" className="text-gray-300">Connected Devices</TabsTrigger>
          <TabsTrigger value="realtime" className="text-gray-300">Real-time Data</TabsTrigger>
          <TabsTrigger value="automation" className="text-gray-300">Automation</TabsTrigger>
          <TabsTrigger value="overview" className="text-gray-300">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedDevices.map((device) => (
              <Card 
                key={device.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedDevice === device.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedDevice(device.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <device.icon className="h-5 w-5 text-blue-400" />
                      {device.name}
                    </CardTitle>
                    <Badge className={getStatusBadge(device.status)}>
                      {device.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {device.brand} • {device.type}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {device.battery && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Battery</span>
                          <span className="text-white">{device.battery}%</span>
                        </div>
                        <Progress value={device.battery} className="h-2" />
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Last Sync</span>
                      <span className="text-white">{device.lastSync}</span>
                    </div>

                    <div>
                      <h4 className="text-gray-300 text-sm font-medium mb-2">Metrics</h4>
                      <div className="flex flex-wrap gap-1">
                        {device.metrics.slice(0, 2).map((metric, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {metric}
                          </Badge>
                        ))}
                        {device.metrics.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{device.metrics.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button 
                      variant={device.status === "connected" ? "outline" : "default"}
                      className="w-full"
                    >
                      {device.status === "connected" ? "Configure" : "Reconnect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedDevice && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Device Details</CardTitle>
                <CardDescription className="text-gray-400">
                  {connectedDevices.find(d => d.id === selectedDevice)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-medium mb-3">All Metrics</h4>
                    <div className="space-y-2">
                      {connectedDevices.find(d => d.id === selectedDevice)?.metrics.map((metric, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Signal className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-gray-300">{metric}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-3">Device Info</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Brand</span>
                        <span className="text-white">{connectedDevices.find(d => d.id === selectedDevice)?.brand}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Type</span>
                        <span className="text-white">{connectedDevices.find(d => d.id === selectedDevice)?.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status</span>
                        <span className={getStatusColor(connectedDevices.find(d => d.id === selectedDevice)?.status || "")}>
                          {connectedDevices.find(d => d.id === selectedDevice)?.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realtimeData.map((data, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg">{data.metric}</CardTitle>
                  <CardDescription className="text-gray-400">
                    {data.device}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-white">
                      {data.value}
                    </div>
                    <Badge className={`${getMetricStatusColor(data.status)} bg-transparent border-current`}>
                      {data.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <div className="space-y-4">
            {automationRules.map((rule, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{rule.name}</CardTitle>
                    <Badge className={rule.status === "active" ? "bg-green-600/20 text-green-300 border-green-500/20" : "bg-gray-600/20 text-gray-300 border-gray-500/20"}>
                      {rule.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-gray-300 font-medium mb-2">Trigger</h4>
                      <p className="text-white">{rule.trigger}</p>
                    </div>
                    <div>
                      <h4 className="text-gray-300 font-medium mb-2">Actions</h4>
                      <div className="space-y-1">
                        {rule.actions.map((action, idx) => (
                          <div key={idx} className="text-sm text-gray-300">• {action}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant={rule.status === "active" ? "outline" : "default"}
                      size="sm"
                    >
                      {rule.status === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="outline" size="sm">
                      Edit Rule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {deviceCategories.map((category, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <category.icon className="h-5 w-5 text-blue-400" />
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">
                    {category.count}
                  </div>
                  <p className="text-gray-400 text-sm">Connected devices</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">System Health</CardTitle>
              <CardDescription className="text-gray-400">
                Overall status of your IoT ecosystem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">94%</div>
                  <p className="text-gray-400">Device Uptime</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-2">5.2GB</div>
                  <p className="text-gray-400">Data Collected</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-2">12</div>
                  <p className="text-gray-400">Active Automations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
