import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"

export type DisclaimerVariant = "inline" | "banner" | "compact"

interface MedicalDisclaimerProps {
  variant?: DisclaimerVariant
  className?: string
}

const DISCLAIMER_TEXT =
  "This content is for informational and research purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making decisions about your health or treatment plan."

export function MedicalDisclaimer({
  variant = "inline",
  className,
}: MedicalDisclaimerProps) {
  if (variant === "compact") {
    return (
      <p
        className={cn(
          "text-xs text-muted-foreground italic",
          className
        )}
      >
        Not medical advice — consult a healthcare professional.
      </p>
    )
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3",
          className
        )}
        role="alert"
      >
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-200 leading-relaxed">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    )
  }

  // Default: inline
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card/50 px-4 py-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    </div>
  )
}
