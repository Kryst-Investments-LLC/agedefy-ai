import { Card, CardContent } from "@/components/ui/card"

export function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-white/10 bg-white/5 shadow-none">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}
