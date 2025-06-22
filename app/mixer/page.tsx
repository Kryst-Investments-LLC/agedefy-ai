import { CompoundMixer } from "@/components/compound-mixer"
import { SafetyDisclaimer } from "@/components/safety-disclaimer"
import { Navigation } from "@/components/navigation"

export default function MixerPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <SafetyDisclaimer />
      <CompoundMixer />
    </div>
  )
}
