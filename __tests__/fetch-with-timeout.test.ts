import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout"

// A fetch that never resolves on its own — only settles when its signal aborts,
// simulating an unresponsive upstream.
function hangingFetch() {
  return vi.fn((_input: unknown, init: RequestInit = {}) =>
    new Promise<Response>((_resolve, reject) => {
      // Mirror real fetch: reject immediately if the signal is already aborted,
      // otherwise reject when it aborts.
      if (init.signal?.aborted) {
        reject(init.signal.reason)
        return
      }
      init.signal?.addEventListener("abort", () => reject(init.signal!.reason))
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("fetchWithTimeout", () => {
  it("returns the response when fetch resolves before the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })))
    const res = await fetchWithTimeout("http://x", {}, 1_000)
    expect(res.status).toBe(200)
  })

  it("aborts with a TimeoutError when the upstream exceeds the timeout", async () => {
    vi.stubGlobal("fetch", hangingFetch())
    await expect(fetchWithTimeout("http://x", {}, 20)).rejects.toMatchObject({ name: "TimeoutError" })
  })

  it("aborts when a caller-supplied signal is already aborted", async () => {
    vi.stubGlobal("fetch", hangingFetch())
    const controller = new AbortController()
    controller.abort(new Error("caller cancelled"))
    await expect(fetchWithTimeout("http://x", { signal: controller.signal }, 5_000)).rejects.toThrow(
      "caller cancelled",
    )
  })
})
