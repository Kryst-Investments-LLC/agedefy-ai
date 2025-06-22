"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, X, Shield, BookOpen, Users, Phone } from "lucide-react"

export function SafetyDisclaimer() {
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [hasReadTerms, setHasReadTerms] = useState(false)
  const [hasReadSafety, setHasReadSafety] = useState(false)

  useEffect(() => {
    const hasSeenDisclaimer = localStorage.getItem("agedefy-disclaimer-seen")
    const disclaimerVersion = localStorage.getItem("agedefy-disclaimer-version")

    // Show disclaimer if never seen or if version has changed
    if (!hasSeenDisclaimer || disclaimerVersion !== "2.0") {
      setShowDisclaimer(true)
    }
  }, [])

  const acceptDisclaimer = () => {
    if (hasReadTerms && hasReadSafety) {
      localStorage.setItem("agedefy-disclaimer-seen", "true")
      localStorage.setItem("agedefy-disclaimer-version", "2.0")
      localStorage.setItem("agedefy-disclaimer-timestamp", new Date().toISOString())
      setShowDisclaimer(false)
    }
  }

  if (!showDisclaimer) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full bg-gray-800 border-red-500/20 max-h-[90vh] overflow-y-auto">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="bg-red-600 rounded-full p-3 flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-6">Important Safety & Legal Notice</h2>

              {/* Critical Warning */}
              <Alert className="border-red-500/20 bg-red-500/10 mb-6">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <AlertDescription className="text-red-200 font-medium">
                  <strong>CRITICAL:</strong> This application is for educational and research purposes ONLY. It does NOT
                  provide medical advice and should NEVER replace professional healthcare consultation.
                </AlertDescription>
              </Alert>

              {/* Main Content */}
              <div className="space-y-6">
                {/* Medical Disclaimer */}
                <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <h3 className="text-xl font-semibold text-white">Medical Disclaimer</h3>
                  </div>
                  <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
                    <p>
                      <strong>This platform is NOT a medical device or diagnostic tool.</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>All information is for educational purposes only</li>
                      <li>AI predictions are estimates based on available research, not medical diagnoses</li>
                      <li>Individual responses to compounds vary significantly</li>
                      <li>Always consult qualified healthcare providers before starting any supplement regimen</li>
                      <li>Never stop prescribed medications without medical supervision</li>
                      <li>Seek immediate medical attention for any adverse reactions</li>
                    </ul>
                  </div>
                </div>

                {/* Safety Information */}
                <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <h3 className="text-xl font-semibold text-white">Safety Considerations</h3>
                  </div>
                  <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
                    <p>
                      <strong>Before using any compounds mentioned in this app:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Consult with a healthcare provider familiar with anti-aging medicine</li>
                      <li>Disclose all medications, supplements, and health conditions</li>
                      <li>Start with the lowest effective doses</li>
                      <li>Monitor for side effects and interactions</li>
                      <li>Regular health monitoring and blood work may be necessary</li>
                      <li>Pregnant or nursing women should avoid most supplements</li>
                      <li>Children and adolescents should not use anti-aging compounds</li>
                    </ul>
                  </div>
                </div>

                {/* For Regular Users */}
                <div className="bg-teal-900/20 border border-teal-500/20 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-teal-400" />
                    <h3 className="text-xl font-semibold text-white">For Non-Experts</h3>
                  </div>
                  <div className="text-teal-200 text-sm leading-relaxed">
                    <p className="mb-3">
                      <strong>
                        We make complex science accessible, but this doesn't replace professional guidance:
                      </strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Our explanations simplify complex topics for understanding</li>
                      <li>Safety warnings are comprehensive but not exhaustive</li>
                      <li>When in doubt, always ask your doctor or pharmacist</li>
                      <li>Consider working with a functional medicine practitioner</li>
                      <li>Join our community for peer support, but remember it's not medical advice</li>
                    </ul>
                  </div>
                </div>

                {/* Legal Information */}
                <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-5 w-5 text-purple-400" />
                    <h3 className="text-xl font-semibold text-white">Legal Information</h3>
                  </div>
                  <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>This app is not FDA approved for medical use</li>
                      <li>We are not liable for any health outcomes from using this information</li>
                      <li>Users assume full responsibility for their health decisions</li>
                      <li>Data privacy is protected under GDPR and HIPAA guidelines</li>
                      <li>Research citations are provided for transparency</li>
                      <li>AI models are continuously updated but may contain errors</li>
                    </ul>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-red-400" />
                    <strong className="text-red-200">Emergency:</strong>
                  </div>
                  <p className="text-red-200 text-sm">
                    If you experience adverse reactions, contact emergency services immediately. For poison control:
                    1-800-222-1222 (US)
                  </p>
                </div>

                {/* Acknowledgment Checkboxes */}
                <div className="space-y-4 bg-gray-700/30 rounded-lg p-6">
                  <h3 className="text-white font-semibold">Required Acknowledgments:</h3>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms"
                      checked={hasReadTerms}
                      onCheckedChange={(checked) => setHasReadTerms(checked as boolean)}
                      className="mt-1"
                    />
                    <label htmlFor="terms" className="text-sm text-gray-300 leading-relaxed">
                      I understand this is for educational purposes only and does not constitute medical advice. I will
                      consult healthcare professionals before making any health-related decisions.
                    </label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="safety"
                      checked={hasReadSafety}
                      onCheckedChange={(checked) => setHasReadSafety(checked as boolean)}
                      className="mt-1"
                    />
                    <label htmlFor="safety" className="text-sm text-gray-300 leading-relaxed">
                      I acknowledge the safety warnings and understand that I use this information at my own risk. I
                      will not hold AgeDefy AI liable for any health outcomes.
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={acceptDisclaimer}
                    disabled={!hasReadTerms || !hasReadSafety}
                    className="bg-teal-600 hover:bg-teal-700 flex-1 py-3"
                  >
                    <Shield className="h-4 w-4 mr-2" />I Understand & Accept - Continue Safely
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.history.back()}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 px-6"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Go Back
                  </Button>
                </div>

                <div className="text-center text-xs text-gray-500 pt-4">
                  By continuing, you agree to our Terms of Service and Privacy Policy. Last updated:{" "}
                  {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
