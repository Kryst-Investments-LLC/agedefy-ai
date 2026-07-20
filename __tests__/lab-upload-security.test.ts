import { describe, expect, it } from "vitest"

import {
  MAX_LAB_PDF_PAGES,
  UnsafeLabUploadError,
  validateLabUploadBytes,
} from "@/lib/security/lab-upload"

describe("lab upload validation", () => {
  it("accepts supported file signatures", () => {
    expect(() => validateLabUploadBytes(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    )).not.toThrow()
    expect(() => validateLabUploadBytes(
      Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
      "image/jpeg",
    )).not.toThrow()
  })

  it("rejects MIME spoofing", () => {
    expect(() => validateLabUploadBytes(
      new TextEncoder().encode("<script>not an image</script>"),
      "image/png",
    )).toThrow(UnsafeLabUploadError)
  })

  it("rejects oversized PDFs by page marker count", () => {
    const pdf = `%PDF-1.7\n${"/Type /Page\n".repeat(MAX_LAB_PDF_PAGES + 1)}`
    expect(() => validateLabUploadBytes(
      new TextEncoder().encode(pdf),
      "application/pdf",
    )).toThrow(`PDF exceeds ${MAX_LAB_PDF_PAGES} pages`)
  })

  it("rejects empty uploads", () => {
    expect(() => validateLabUploadBytes(new Uint8Array(), "image/png")).toThrow("Empty upload")
  })
})
