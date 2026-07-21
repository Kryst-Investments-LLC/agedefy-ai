export const MAX_LAB_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_LAB_PDF_PAGES = 50

// P0-SEC-010 — active/executable content markers that must never appear in an
// uploaded lab report. A lab report is a static document; embedded JavaScript,
// launch actions, embedded files, and rich media are never legitimately needed
// and are the primary PDF malware vectors, so their presence fails the upload.
export const PDF_ACTIVE_CONTENT_MARKERS = [
  "/JavaScript",
  "/JS",
  "/Launch",
  "/EmbeddedFile",
  "/RichMedia",
] as const

export class UnsafeLabUploadError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = "UnsafeLabUploadError"
  }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

export function validateLabUploadBytes(bytes: Uint8Array, declaredMimeType: string) {
  if (!bytes.byteLength) throw new UnsafeLabUploadError("Empty upload", 400)
  if (bytes.byteLength > MAX_LAB_UPLOAD_BYTES) {
    throw new UnsafeLabUploadError(`Upload exceeds ${MAX_LAB_UPLOAD_BYTES} bytes`, 413)
  }

  const mimeType = declaredMimeType.toLowerCase()
  const validSignature = mimeType === "application/pdf"
    ? startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
    : mimeType === "image/png"
      ? startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : mimeType === "image/jpeg" || mimeType === "image/jpg"
        ? startsWith(bytes, [0xff, 0xd8, 0xff])
        : mimeType === "image/gif"
          ? startsWith(bytes, [0x47, 0x49, 0x46, 0x38])
          : mimeType === "image/webp"
            ? startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
            : false

  if (!validSignature) {
    throw new UnsafeLabUploadError("File content does not match its declared type", 415)
  }

  if (mimeType === "application/pdf") {
    const ascii = Buffer.from(bytes).toString("latin1")
    const pageCount = ascii.match(/\/Type\s*\/Page\b/g)?.length ?? 0
    if (pageCount > MAX_LAB_PDF_PAGES) {
      throw new UnsafeLabUploadError(`PDF exceeds ${MAX_LAB_PDF_PAGES} pages`, 413)
    }

    const activeMarker = PDF_ACTIVE_CONTENT_MARKERS.find((marker) => ascii.includes(marker))
    if (activeMarker) {
      throw new UnsafeLabUploadError(
        `PDF contains disallowed active content (${activeMarker})`,
        415,
      )
    }
  }
}

export function validateTextLabUpload(file: File) {
  if (!file.size) throw new UnsafeLabUploadError("Empty upload", 400)
  if (file.size > MAX_LAB_UPLOAD_BYTES) {
    throw new UnsafeLabUploadError(`Upload exceeds ${MAX_LAB_UPLOAD_BYTES} bytes`, 413)
  }
}
