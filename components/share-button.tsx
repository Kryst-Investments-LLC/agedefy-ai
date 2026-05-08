"use client"

import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ShareButtonProps {
  /** URL to share */
  url: string
  /** Share title */
  title: string
  /** Share description/text */
  text?: string
  /** Social platforms to show as fallback */
  platforms?: ("twitter" | "linkedin" | "facebook")[]
  /** Optional className for wrapper */
  className?: string
}

/* ------------------------------------------------------------------ */
/*  Social URL builders                                               */
/* ------------------------------------------------------------------ */

function twitterShareUrl(url: string, text: string): string {
  const params = new URLSearchParams({ url, text })
  return `https://x.com/intent/tweet?${params.toString()}`
}

function linkedinShareUrl(url: string): string {
  const params = new URLSearchParams({ url })
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`
}

function facebookShareUrl(url: string): string {
  const params = new URLSearchParams({ u: url })
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ShareButton({
  url,
  title,
  text,
  platforms = ["twitter", "linkedin", "facebook"],
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  const shareText = text ?? title

  const handleShare = useCallback(async () => {
    // Try Web Share API first (mobile)
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text: shareText, url })
        return
      } catch {
        // User cancelled or API not available — fall through to fallback
      }
    }

    // Show fallback buttons
    setShowFallback(true)
  }, [title, shareText, url])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text in a temp input
      const input = document.createElement("input")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [url])

  const platformButtons = {
    twitter: (
      <a
        key="twitter"
        href={twitterShareUrl(url, shareText)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <Button variant="outline" size="sm">
          𝕏 Twitter
        </Button>
      </a>
    ),
    linkedin: (
      <a
        key="linkedin"
        href={linkedinShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <Button variant="outline" size="sm">
          in LinkedIn
        </Button>
      </a>
    ),
    facebook: (
      <a
        key="facebook"
        href={facebookShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <Button variant="outline" size="sm">
          f Facebook
        </Button>
      </a>
    ),
  }

  return (
    <div className={className}>
      <Button onClick={handleShare} variant="default" size="sm">
        Share
      </Button>

      {showFallback && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {platforms.map((p) => platformButtons[p])}
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy Link"}
          </Button>
        </div>
      )}
    </div>
  )
}
