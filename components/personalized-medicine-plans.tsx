"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Stethoscope, Pill, Calendar, Video, FileText, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { useTranslation } from "@/lib/i18n/context"

export function PersonalizedMedicinePlans() {
  const { t } = useTranslation()
  const [activeProtocol, setActiveProtocol] = useState("longevity-basic")

  const protocols = [
    {
      id: "longevity-basic",
      name: "Longevity Foundation Protocol",
      duration: "3 months",
      complexity: "Beginner",
      status: "active",
      progress: 65,
      supplements: [
        { name: "NMN", dosage: "500mg", timing: "Morning", status: "taking" },
        { name: "Resveratrol", dosage: "250mg", timing: "Evening", status: "taking" },
        { name: "Omega-3", dosage: "2g", timing: "With meals", status: "taking" },
        { name: "Vitamin D3", dosage: "4000 IU", timing: "Morning", status: "pending" }
      ],
      nextAppointment: "2025-07-15",
      physician: "Dr. Sarah Chen, MD"
    },
    {
      id: "metabolic-optimization",
      name: "Metabolic Optimization Protocol",
      duration: "6 months",
      complexity: "Intermediate",
      status: "recommended",
      progress: 0,
      supplements: [
        { name: "Metformin", dosage: "500mg", timing: "With dinner", status: "prescribed" },
        { name: "Berberine", dosage: "500mg", timing: "Before meals", status: "recommended" },
        { name: "Alpha-Lipoic Acid", dosage: "300mg", timing: "Morning", status: "recommended" }
      ],
      nextAppointment: null,
      physician: "Dr. Michael Rodriguez, MD"
    }
  ]

  const upcomingAppointments = [
    {
      date: "2025-07-15",
      time: "10:00 AM",
      physician: "Dr. Sarah Chen, MD",
      type: "Follow-up Consultation",
      mode: "Video Call",
      status: "confirmed"
    },
    {
      date: "2025-07-22",
      time: "2:30 PM",
      physician: "Dr. Michael Rodriguez, MD",
      type: "Protocol Review",
      mode: "In-Person",
      status: "pending"
    }
  ]

  const prescriptions = [
    {
      medication: "Metformin ER",
      dosage: "500mg",
      frequency: "Once daily",
      quantity: "90 tablets",
      refills: 2,
      prescriber: "Dr. Sarah Chen, MD",
      status: "active",
      nextRefill: "2025-08-15"
    },
    {
      medication: "Vitamin D3",
      dosage: "4000 IU",
      frequency: "Daily",
      quantity: "120 capsules",
      refills: 5,
      prescriber: "Dr. Sarah Chen, MD",
      status: "ready_for_pickup",
      nextRefill: "2025-09-01"
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": case "taking": case "confirmed": return "text-green-400 bg-green-900/20 border-green-700"
      case "pending": case "recommended": return "text-yellow-400 bg-yellow-900/20 border-yellow-700"
      case "ready_for_pickup": return "text-blue-400 bg-blue-900/20 border-blue-700"
      case "prescribed": return "text-purple-400 bg-purple-900/20 border-purple-700"
      default: return "text-gray-400 bg-gray-900/20 border-gray-700"
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Personalized Medicine Plans</h2>
        <p className="text-gray-400">Healthcare provider partnerships for telemedicine and prescription management</p>
      </div>

      <Tabs defaultValue="protocols" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="protocols" className="text-gray-300">Active Protocols</TabsTrigger>
          <TabsTrigger value="appointments" className="text-gray-300">Appointments</TabsTrigger>
          <TabsTrigger value="prescriptions" className="text-gray-300">Prescriptions</TabsTrigger>
          <TabsTrigger value="providers" className="text-gray-300">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="protocols" className="space-y-4">
          <div className="space-y-4">
            {protocols.map((protocol) => (
              <Card key={protocol.id} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-blue-400" />
                      {protocol.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge className={getStatusColor(protocol.status)}>
                        {protocol.status}
                      </Badge>
                      <Badge variant="outline" className="text-gray-300">
                        {protocol.complexity}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-gray-400">
                    Duration: {protocol.duration} • Physician: {protocol.physician}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {protocol.status === "active" && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white">{protocol.progress}%</span>
                      </div>
                      <Progress value={protocol.progress} className="h-2" />
                    </div>
                  )}

                  <div>
                    <h4 className="text-white font-medium mb-3">Supplement Protocol</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {protocol.supplements.map((supplement, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                          <div>
                            <div className="text-white font-medium">{supplement.name}</div>
                            <div className="text-sm text-gray-400">{supplement.dosage} • {supplement.timing}</div>
                          </div>
                          <Badge className={getStatusColor(supplement.status)} size="sm">
                            {supplement.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {protocol.nextAppointment && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Calendar className="h-4 w-4" />
                      Next appointment: {protocol.nextAppointment}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                    {protocol.status === "recommended" && (
                      <Button size="sm">
                        Start Protocol
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <div className="space-y-4">
            {upcomingAppointments.map((appointment, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {appointment.mode === "Video Call" ? (
                        <Video className="h-5 w-5 text-green-400" />
                      ) : (
                        <Stethoscope className="h-5 w-5 text-blue-400" />
                      )}
                      {appointment.type}
                    </CardTitle>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {appointment.physician}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-white">{appointment.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-white">{appointment.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {appointment.mode === "Video Call" ? (
                        <Video className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Stethoscope className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-white">{appointment.mode}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {appointment.mode === "Video Call" && (
                      <Button size="sm">
                        Join Video Call
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      Reschedule
                    </Button>
                    <Button size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Schedule New Appointment</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Book Consultation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-4">
          <div className="space-y-4">
            {prescriptions.map((prescription, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Pill className="h-5 w-5 text-green-400" />
                      {prescription.medication}
                    </CardTitle>
                    <Badge className={getStatusColor(prescription.status)}>
                      {prescription.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    Prescribed by {prescription.prescriber}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Dosage</div>
                      <div className="text-white">{prescription.dosage}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Frequency</div>
                      <div className="text-white">{prescription.frequency}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Quantity</div>
                      <div className="text-white">{prescription.quantity}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Refills Left</div>
                      <div className="text-white">{prescription.refills}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                    <Calendar className="h-4 w-4" />
                    Next refill due: {prescription.nextRefill}
                  </div>
                  <div className="flex gap-2">
                    {prescription.status === "ready_for_pickup" && (
                      <Button size="sm">
                        Pickup Ready
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      Request Refill
                    </Button>
                    <Button size="sm" variant="outline">
                      Transfer Pharmacy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Dr. Sarah Chen, MD</CardTitle>
                <CardDescription className="text-gray-400">
                  Longevity Medicine Specialist
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="text-sm">
                    <span className="text-gray-400">Specialties:</span>
                    <span className="text-white ml-2">Anti-aging, Preventive Medicine</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Experience:</span>
                    <span className="text-white ml-2">15+ years</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Rating:</span>
                    <span className="text-white ml-2">4.9/5 ⭐</span>
                  </div>
                </div>
                <Button size="sm" className="w-full">
                  Schedule Appointment
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Dr. Michael Rodriguez, MD</CardTitle>
                <CardDescription className="text-gray-400">
                  Metabolic Health Specialist
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="text-sm">
                    <span className="text-gray-400">Specialties:</span>
                    <span className="text-white ml-2">Diabetes, Metabolic Disorders</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Experience:</span>
                    <span className="text-white ml-2">12+ years</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">Rating:</span>
                    <span className="text-white ml-2">4.8/5 ⭐</span>
                  </div>
                </div>
                <Button size="sm" className="w-full">
                  Schedule Appointment
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
