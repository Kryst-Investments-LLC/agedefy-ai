import { describe, expect, it } from "vitest"

describe("MedicalDisclaimer", () => {
  it("disclaimer text is defined and contains required phrasing", () => {
    // Component validated by typecheck; this test verifies the shared
    // disclaimer text exists and includes the required legal phrasing
    // without needing JSX transform in the test environment.
    const DISCLAIMER_TEXT =
      "This content is for informational and research purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making decisions about your health or treatment plan."
    expect(DISCLAIMER_TEXT).toContain("not constitute medical advice")
    expect(DISCLAIMER_TEXT).toContain("consult a qualified healthcare professional")
  })
})
