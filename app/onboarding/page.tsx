import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export const metadata = {
  title: "Get Started — Biozephyra",
  description: "Complete your profile to get personalised longevity recommendations.",
}

export default function OnboardingPage() {
  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <OnboardingWizard />
    </div>
  )
}
