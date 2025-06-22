"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Video, Calendar, FileText, Stethoscope, Clock, Star, MessageSquare, Shield, CheckCircle } from "lucide-react"

const doctors = [
  {
    id: 1,
    name: "Dr. Sarah Martinez",
    specialty: "Longevity Medicine",
    rating: 4.9,
    reviews: 234,
    experience: "15 years",
    nextAvailable: "Today 3:00 PM",
    consultationFee: 150,
    avatar: "/placeholder.svg?height=80&width=80",
    credentials: ["MD", "Board Certified Internal Medicine", "Fellowship in Longevity"],
    specialties: ["NAD+ Optimization", "Hormone Therapy", "Biomarker Analysis"],
    languages: ["English", "Spanish"],
  },
  {
    id: 2,
    name: "Dr. Michael Chen",
    specialty: "Functional Medicine",
    rating: 4.8,
    reviews: 189,
    experience: "12 years",
    nextAvailable: "Tomorrow 10:00 AM",
    consultationFee: 175,
    avatar: "/placeholder.svg?height=80&width=80",
    credentials: ["MD", "Institute for Functional Medicine Certified", "PhD Biochemistry"],
    specialties: ["Genetic Analysis", "Supplement Protocols", "Metabolic Optimization"],
    languages: ["English", "Mandarin"],
  },
  {
    id: 3,
    name: "Dr. Lisa Thompson",
    specialty: "Anti-Aging Medicine",
    rating: 4.9,
    reviews: 312,
    experience: "18 years",
    nextAvailable: "Dec 28 2:00 PM",
    consultationFee: 200,
    avatar: "/placeholder.svg?height=80&width=80",
    credentials: ["MD", "A4M Board Certified", "Fellowship in Regenerative Medicine"],
    specialties: ["Senolytic Therapy", "Peptide Protocols", "Advanced Diagnostics"],
    languages: ["English", "French"],
  },
]

const upcomingAppointments = [
  {
    id: 1,
    doctor: "Dr. Sarah Martinez",
    date: "Dec 26, 2024",
    time: "3:00 PM",
    type: "Video Consultation",
    purpose: "NAD+ Protocol Review",
    status: "confirmed",
  },
  {
    id: 2,
    doctor: "Dr. Michael Chen",
    date: "Jan 5, 2025",
    time: "10:00 AM",
    type: "Lab Review",
    purpose: "Biomarker Analysis",
    status: "pending",
  },
]

export function TelemedicineIntegration() {
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Longevity Medical Consultations</h1>
        <p className="text-gray-400 text-lg">
          Connect with board-certified longevity doctors for personalized medical guidance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Available Doctors */}
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Available Longevity Specialists
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {doctors.map((doctor) => (
                  <div key={doctor.id} className="bg-gray-700 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={doctor.avatar || "/placeholder.svg"} alt={doctor.name} />
                        <AvatarFallback className="bg-gray-600 text-white">
                          {doctor.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-white font-semibold text-lg">{doctor.name}</h3>
                            <p className="text-teal-400">{doctor.specialty}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 mb-1">
                              <Star className="h-4 w-4 text-yellow-400 fill-current" />
                              <span className="text-white font-medium">{doctor.rating}</span>
                              <span className="text-gray-400 text-sm">({doctor.reviews})</span>
                            </div>
                            <p className="text-gray-400 text-sm">{doctor.experience} experience</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="text-gray-300 font-medium text-sm mb-2">Credentials</h4>
                            <div className="space-y-1">
                              {doctor.credentials.map((cred, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="border-blue-500 text-blue-300 text-xs mr-1"
                                >
                                  {cred}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-gray-300 font-medium text-sm mb-2">Specialties</h4>
                            <div className="space-y-1">
                              {doctor.specialties.map((specialty, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-gray-600 text-gray-300 text-xs mr-1">
                                  {specialty}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>Next: {doctor.nextAvailable}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>${doctor.consultationFee} consultation</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-600 text-gray-300 hover:bg-gray-600"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                              <Video className="h-4 w-4 mr-1" />
                              Book Consultation
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Appointments */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-white font-medium">{appointment.doctor}</h4>
                          <p className="text-gray-400 text-sm">{appointment.purpose}</p>
                        </div>
                        <Badge
                          className={
                            appointment.status === "confirmed"
                              ? "bg-green-600/20 text-green-300 border-green-500/20"
                              : "bg-yellow-600/20 text-yellow-300 border-yellow-500/20"
                          }
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {appointment.date} at {appointment.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <Video className="h-4 w-4" />
                        <span>{appointment.type}</span>
                      </div>
                    </div>
                  ))}
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Video className="h-4 w-4 mr-2" />
                    Join Next Appointment
                  </Button>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No upcoming appointments</p>
              )}
            </CardContent>
          </Card>

          {/* Medical Records */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Medical Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Lab Results</span>
                  <Badge className="bg-green-600/20 text-green-300 border-green-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Updated
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Consultation Notes</span>
                  <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/20">3 files</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Prescriptions</span>
                  <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/20">2 active</Badge>
                </div>
              </div>

              <Button className="w-full mt-4 bg-teal-600 hover:bg-teal-700">
                <FileText className="h-4 w-4 mr-2" />
                View All Records
              </Button>
            </CardContent>
          </Card>

          {/* Insurance & Billing */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Insurance & Billing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Insurance Status</span>
                  <span className="text-green-400">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Coverage</span>
                  <span className="text-gray-400">80% covered</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Outstanding Balance</span>
                  <span className="text-white">$0.00</span>
                </div>
              </div>

              <Button variant="outline" className="w-full mt-4 border-gray-600 text-gray-300 hover:bg-gray-700">
                Billing History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
