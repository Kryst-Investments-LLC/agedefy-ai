"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Shield,
  Lock,
  Globe,
  FileText,
  CheckCircle,
  AlertTriangle,
  Users,
  Database,
  Eye,
  Scale,
  Award,
  Clock,
} from "lucide-react"

const complianceFrameworks = [
  {
    framework: "HIPAA",
    region: "United States",
    status: "compliant",
    coverage: 100,
    lastAudit: "2024-12-15",
    nextReview: "2025-06-15",
    icon: Shield,
    requirements: [
      "Administrative safeguards implemented",
      "Physical safeguards in place",
      "Technical safeguards active",
      "Business associate agreements signed",
      "Breach notification procedures established",
    ],
    certifications: ["HIPAA Security Rule", "HIPAA Privacy Rule"],
  },
  {
    framework: "GDPR",
    region: "European Union",
    status: "compliant",
    coverage: 100,
    lastAudit: "2024-11-20",
    nextReview: "2025-05-20",
    icon: Lock,
    requirements: [
      "Data protection by design implemented",
      "Consent management system active",
      "Right to erasure functionality",
      "Data portability features",
      "Privacy impact assessments completed",
    ],
    certifications: ["ISO 27001", "Privacy Shield Framework"],
  },
  {
    framework: "FDA 21 CFR Part 820",
    region: "United States",
    status: "in-progress",
    coverage: 75,
    lastAudit: "2024-10-10",
    nextReview: "2025-04-10",
    icon: FileText,
    requirements: [
      "Quality management system established",
      "Design controls implemented",
      "Risk management procedures",
      "Clinical evaluation protocols",
      "Post-market surveillance system",
    ],
    certifications: ["ISO 13485 (Pending)"],
  },
  {
    framework: "SOC 2 Type II",
    region: "Global",
    status: "compliant",
    coverage: 95,
    lastAudit: "2024-09-30",
    nextReview: "2025-09-30",
    icon: Database,
    requirements: [
      "Security controls implemented",
      "Availability monitoring active",
      "Processing integrity verified",
      "Confidentiality measures in place",
      "Privacy controls operational",
    ],
    certifications: ["SOC 2 Type II Report"],
  },
]

const regionalCompliance = [
  {
    region: "United States",
    population: "331M",
    frameworks: ["HIPAA", "FDA", "SOC 2"],
    status: "compliant",
    marketAccess: 100,
    requirements: [
      "Healthcare data protection",
      "Medical device regulations",
      "Consumer privacy laws",
    ],
  },
  {
    region: "European Union",
    population: "447M",
    frameworks: ["GDPR", "MDR", "IVDR"],
    status: "compliant",
    marketAccess: 100,
    requirements: [
      "Data protection regulation",
      "Medical device regulation",
      "In-vitro diagnostic regulation",
    ],
  },
  {
    region: "India",
    population: "1.4B",
    frameworks: ["DPDP", "IT Rules"],
    status: "compliant",
    marketAccess: 100,
    requirements: [
      "Digital Personal Data Protection",
      "Information Technology Rules",
      "Telemedicine guidelines",
    ],
  },
  {
    region: "Canada",
    population: "38M",
    frameworks: ["PIPEDA", "Health Canada"],
    status: "compliant",
    marketAccess: 100,
    requirements: [
      "Personal Information Protection",
      "Health product regulations",
      "Digital health standards",
    ],
  },
  {
    region: "Australia",
    population: "26M",
    frameworks: ["Privacy Act", "TGA"],
    status: "compliant",
    marketAccess: 100,
    requirements: [
      "Privacy Act compliance",
      "Therapeutic Goods Administration",
      "Digital health regulations",
    ],
  },
  {
    region: "China",
    population: "1.4B",
    frameworks: ["PIPL", "Cybersecurity Law"],
    status: "planned",
    marketAccess: 0,
    requirements: [
      "Personal Information Protection Law",
      "Cybersecurity Law compliance",
      "Data localization requirements",
    ],
  },
]

const securityMeasures = [
  {
    category: "Data Encryption",
    implementation: "AES-256 encryption at rest and in transit",
    status: "active",
    coverage: 100,
    icon: Lock,
  },
  {
    category: "Access Controls",
    implementation: "Multi-factor authentication and role-based access",
    status: "active",
    coverage: 100,
    icon: Users,
  },
  {
    category: "Audit Logging",
    implementation: "Comprehensive activity logging and monitoring",
    status: "active",
    coverage: 100,
    icon: Eye,
  },
  {
    category: "Data Backup",
    implementation: "Automated daily backups with 99.9% recovery SLA",
    status: "active",
    coverage: 100,
    icon: Database,
  },
  {
    category: "Incident Response",
    implementation: "24/7 security monitoring and response team",
    status: "active",
    coverage: 100,
    icon: Shield,
  },
  {
    category: "Vulnerability Management",
    implementation: "Regular security assessments and penetration testing",
    status: "active",
    coverage: 95,
    icon: AlertTriangle,
  },
]

export function RegulatoryCompliance() {
  const totalMarketAccess = regionalCompliance.reduce((sum, region) => {
    const population = parseFloat(region.population.replace(/[^\d.]/g, ''))
    return sum + (population * region.marketAccess / 100)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Regulatory Compliance</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comprehensive compliance framework ensuring global market access and healthcare-grade security standards
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Globe className="h-8 w-8 text-teal-400" />
                <Badge className="bg-green-600/20 text-green-300">Active</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{totalMarketAccess.toFixed(1)}B</div>
              <div className="text-sm text-gray-400">Addressable Population</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Shield className="h-8 w-8 text-green-400" />
                <Badge className="bg-green-600/20 text-green-300">Compliant</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">4/6</div>
              <div className="text-sm text-gray-400">Frameworks Compliant</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Award className="h-8 w-8 text-purple-400" />
                <Badge className="bg-purple-600/20 text-purple-300">Certified</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">7</div>
              <div className="text-sm text-gray-400">Active Certifications</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Clock className="h-8 w-8 text-blue-400" />
                <Badge className="bg-blue-600/20 text-blue-300">Monitored</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">24/7</div>
              <div className="text-sm text-gray-400">Security Monitoring</div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Compliance Frameworks</h2>
          <div className="space-y-6">
            {complianceFrameworks.map((framework, index) => {
              const FrameworkIcon = framework.icon
              return (
                <Card key={index} className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-teal-600/20">
                          <FrameworkIcon className="h-6 w-6 text-teal-400" />
                        </div>
                        <div>
                          <CardTitle className="text-white">{framework.framework}</CardTitle>
                          <CardDescription>{framework.region}</CardDescription>
                        </div>
                      </div>
                      <Badge 
                        className={
                          framework.status === 'compliant' 
                            ? "bg-green-600/20 text-green-300" 
                            : "bg-yellow-600/20 text-yellow-300"
                        }
                      >
                        {framework.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Compliance Coverage</div>
                        <div className="flex items-center gap-2">
                          <Progress value={framework.coverage} className="flex-1 h-2" />
                          <span className="text-white font-semibold">{framework.coverage}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Last Audit</div>
                        <div className="text-white font-semibold">{framework.lastAudit}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Next Review</div>
                        <div className="text-white font-semibold">{framework.nextReview}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-white font-medium mb-3">Key Requirements</h4>
                        <div className="space-y-2">
                          {framework.requirements.map((req, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                              {req}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-3">Active Certifications</h4>
                        <div className="space-y-2">
                          {framework.certifications.map((cert, idx) => (
                            <Badge key={idx} className="bg-blue-600/20 text-blue-300 mr-2 mb-2">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Global Market Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {regionalCompliance.map((region, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{region.region}</h3>
                      <p className="text-sm text-gray-400">{region.population} people</p>
                    </div>
                    <Badge 
                      className={
                        region.status === 'compliant' 
                          ? "bg-green-600/20 text-green-300" 
                          : "bg-yellow-600/20 text-yellow-300"
                      }
                    >
                      {region.status}
                    </Badge>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">Market Access</div>
                    <div className="flex items-center gap-2">
                      <Progress value={region.marketAccess} className="flex-1 h-2" />
                      <span className="text-white font-semibold">{region.marketAccess}%</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-gray-300">Frameworks:</h4>
                    <div className="flex flex-wrap gap-1">
                      {region.frameworks.map((framework, idx) => (
                        <Badge key={idx} className="bg-blue-600/20 text-blue-300 text-xs">
                          {framework}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Requirements:</h4>
                    <div className="space-y-1">
                      {region.requirements.map((req, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                          <div className="w-1 h-1 bg-teal-400 rounded-full"></div>
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Security Infrastructure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {securityMeasures.map((measure, index) => {
              const MeasureIcon = measure.icon
              return (
                <Card key={index} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 rounded-full bg-teal-600/20">
                        <MeasureIcon className="h-6 w-6 text-teal-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{measure.category}</h3>
                        <p className="text-sm text-gray-400">{measure.implementation}</p>
                      </div>
                      <Badge 
                        className={
                          measure.status === 'active' 
                            ? "bg-green-600/20 text-green-300" 
                            : "bg-yellow-600/20 text-yellow-300"
                        }
                      >
                        {measure.status}
                      </Badge>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-400">Coverage</span>
                        <span className="text-white font-semibold">{measure.coverage}%</span>
                      </div>
                      <Progress value={measure.coverage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-8">Compliance Roadmap</h2>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8">
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q4 2024</h3>
                    <p className="text-sm text-gray-400">HIPAA & GDPR compliance achieved</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q1 2025</h3>
                    <p className="text-sm text-gray-400">FDA 21 CFR Part 820 completion</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Globe className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q2 2025</h3>
                    <p className="text-sm text-gray-400">China market entry preparation</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Q3 2025</h3>
                    <p className="text-sm text-gray-400">Global compliance certification</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="bg-gradient-to-r from-green-600/20 to-teal-600/20 border-green-500/20">
            <CardContent className="p-8">
              <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Healthcare-Grade Security</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Comprehensive regulatory compliance ensuring global market access with healthcare-grade security and privacy protection
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-green-600 hover:bg-green-700">
                  View Compliance Report
                </Button>
                <Button variant="outline" className="border-green-500 text-green-400 hover:bg-green-500 hover:text-white">
                  Download Certificates
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
