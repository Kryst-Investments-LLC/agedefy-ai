"use client"

import { FileText, Hospital, Shield, Download, Upload, Link, CheckCircle, AlertTriangle } from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
export function HealthRecordIntegration() {
  const [selectedProvider, setSelectedProvider] = useState("epic")

  const connectedProviders = [
    {
      id: "epic",
      name: "Epic MyChart",
      type: "EHR System",
      status: "connected",
      lastSync: "2 hours ago",
      records: 156,
      dataTypes: ["Lab Results", "Medications", "Allergies", "Immunizations"]
    },
    {
      id: "cerner",
      name: "Cerner PowerChart",
      type: "EHR System", 
      status: "connected",
      lastSync: "1 day ago",
      records: 89,
      dataTypes: ["Vitals", "Procedures", "Diagnoses", "Care Plans"]
    },
    {
      id: "labcorp",
      name: "LabCorp Patient Portal",
      type: "Lab Provider",
      status: "connected",
      lastSync: "3 hours ago",
      records: 45,
      dataTypes: ["Blood Tests", "Biomarkers", "Genetic Tests"]
    },
    {
      id: "quest",
      name: "Quest Diagnostics",
      type: "Lab Provider",
      status: "pending",
      lastSync: "Never",
      records: 0,
      dataTypes: ["Lab Results", "Pathology", "Molecular Diagnostics"]
    }
  ]

  const healthRecords = [
    {
      date: "2024-12-20",
      type: "Lab Results",
      provider: "LabCorp",
      title: "Comprehensive Metabolic Panel",
      status: "Normal",
      keyFindings: ["Glucose: 92 mg/dL", "Creatinine: 0.9 mg/dL", "eGFR: >60"]
    },
    {
      date: "2024-12-18",
      type: "Medication",
      provider: "Epic MyChart",
      title: "Prescription Update",
      status: "Active",
      keyFindings: ["Metformin 500mg", "Vitamin D3 2000 IU", "Omega-3 1000mg"]
    },
    {
      date: "2024-12-15",
      type: "Vital Signs",
      provider: "Cerner",
      title: "Annual Physical Exam",
      status: "Normal",
      keyFindings: ["BP: 118/76", "HR: 68 bpm", "BMI: 23.4"]
    },
    {
      date: "2024-12-10",
      type: "Imaging",
      provider: "Epic MyChart",
      title: "DEXA Scan",
      status: "Normal",
      keyFindings: ["Bone Density: T-score -0.8", "No osteoporosis", "Fracture risk: Low"]
    }
  ]

  const dataCategories = [
    { name: "Lab Results", count: 89, lastUpdate: "2 hours ago", completeness: 95 },
    { name: "Medications", count: 23, lastUpdate: "1 day ago", completeness: 100 },
    { name: "Allergies", count: 3, lastUpdate: "1 week ago", completeness: 100 },
    { name: "Immunizations", count: 15, lastUpdate: "3 months ago", completeness: 85 },
    { name: "Procedures", count: 12, lastUpdate: "2 weeks ago", completeness: 90 },
    { name: "Diagnoses", count: 8, lastUpdate: "1 month ago", completeness: 100 }
  ]

  const integrationOptions = [
    {
      name: "FHIR API Integration",
      description: "Direct integration with FHIR-compliant health systems",
      status: "Available",
      security: "OAuth 2.0 + SMART on FHIR",
      dataTypes: "All clinical data types"
    },
    {
      name: "HL7 Message Import",
      description: "Import health records via HL7 messaging standards",
      status: "Available", 
      security: "Encrypted transmission",
      dataTypes: "Lab results, medications, procedures"
    },
    {
      name: "PDF Document Upload",
      description: "Manual upload and AI parsing of health documents",
      status: "Available",
      security: "End-to-end encryption",
      dataTypes: "Any PDF health record"
    },
    {
      name: "Wearable Device Sync",
      description: "Automatic sync from fitness trackers and health devices",
      status: "Beta",
      security: "Device-specific encryption",
      dataTypes: "Vitals, activity, sleep data"
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "text-green-400"
      case "pending": return "text-yellow-400"
      case "error": return "text-red-400"
      default: return "text-gray-400"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected": return "bg-green-600/20 text-green-300 border-green-500/20"
      case "pending": return "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
      case "error": return "bg-red-600/20 text-red-300 border-red-500/20"
      default: return "bg-gray-600/20 text-gray-300 border-gray-500/20"
    }
  }

  const getRecordStatusColor = (status: string) => {
    switch (status) {
      case "Normal": return "text-green-400"
      case "Active": return "text-blue-400"
      case "Abnormal": return "text-red-400"
      case "Pending": return "text-yellow-400"
      default: return "text-gray-400"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Health Record Integration</h2>
        <p className="text-gray-400">Seamlessly connect and manage your health data from multiple sources</p>
      </div>

      <Tabs defaultValue="providers" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="providers" className="text-gray-300">Connected Providers</TabsTrigger>
          <TabsTrigger value="records" className="text-gray-300">Health Records</TabsTrigger>
          <TabsTrigger value="data-categories" className="text-gray-300">Data Categories</TabsTrigger>
          <TabsTrigger value="integration" className="text-gray-300">Integration Options</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedProviders.map((provider) => (
              <Card 
                key={provider.id} 
                className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all ${
                  selectedProvider === provider.id ? 'ring-2 ring-teal-500' : ''
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Hospital className="h-5 w-5 text-blue-400" />
                      {provider.name}
                    </CardTitle>
                    <Badge className={getStatusBadge(provider.status)}>
                      {provider.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {provider.type}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Records</span>
                      <span className="text-white">{provider.records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Sync</span>
                      <span className="text-white">{provider.lastSync}</span>
                    </div>
                    
                    <div>
                      <h4 className="text-gray-300 text-sm font-medium mb-2">Data Types</h4>
                      <div className="flex flex-wrap gap-1">
                        {provider.dataTypes.slice(0, 2).map((type, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {provider.dataTypes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{provider.dataTypes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button 
                      variant={provider.status === "connected" ? "outline" : "default"}
                      className="w-full"
                    >
                      {provider.status === "connected" ? "Manage" : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <div className="space-y-4">
            {healthRecords.map((record, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-400" />
                      {record.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{record.type}</Badge>
                      <Badge className={`${getRecordStatusColor(record.status)} bg-transparent border-current`}>
                        {record.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-gray-400">Date: </span>
                      <span className="text-white">{record.date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Provider: </span>
                      <span className="text-white">{record.provider}</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-gray-300 font-medium mb-2">Key Findings</h4>
                    <div className="space-y-1">
                      {record.keyFindings.map((finding, idx) => (
                        <div key={idx} className="text-sm text-gray-300">• {finding}</div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data-categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataCategories.map((category, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-blue-400">
                      {category.count}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Last Update</span>
                      <span className="text-white">{category.lastUpdate}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Completeness</span>
                        <span className="text-white">{category.completeness}%</span>
                      </div>
                      <Progress value={category.completeness} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integration" className="space-y-4">
          <div className="space-y-4">
            {integrationOptions.map((option, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Link className="h-5 w-5 text-green-400" />
                      {option.name}
                    </CardTitle>
                    <Badge className={option.status === "Available" ? "bg-green-600/20 text-green-300 border-green-500/20" : "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"}>
                      {option.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-gray-400">Security: </span>
                      <span className="text-white">{option.security}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Data Types: </span>
                      <span className="text-white">{option.dataTypes}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className={`w-full ${option.status === "Available" ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'}`}
                    disabled={option.status !== "Available"}
                  >
                    {option.status === "Available" ? "Set Up Integration" : "Coming Soon"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
