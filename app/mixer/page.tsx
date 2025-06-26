import { CompoundMixer } from "@/components/compound-mixer"
import { Navigation } from "@/components/navigation"
import { SafetyDisclaimer } from "@/components/safety-disclaimer"

export default function MixerPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <SafetyDisclaimer />
      <CompoundMixer />
    </div>
  )
}
