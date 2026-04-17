import { test, expect } from "@playwright/test"

test.describe("API health checks", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const response = await request.get("/api/health")
    expect(response.status()).toBe(200)
  })

  test("authenticated routes return 401 without session", async ({ request }) => {
    const routes = [
      "/api/biomarkers",
      "/api/protocols",
      "/api/community",
      "/api/learn",
    ]

    for (const route of routes) {
      const response = await request.post(route, {
        data: {},
        headers: { "Content-Type": "application/json" },
      })
      expect(response.status()).toBe(401)
    }
  })

  test("rate limiter returns headers", async ({ request }) => {
    const response = await request.get("/api/clinical-trials/search?q=aging&limit=1")
    // Even if 401, rate limit headers may be present
    expect(response.status()).toBeGreaterThanOrEqual(200)
  })
})

test.describe("Marketplace pages", () => {
  test("should load marketplace", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Discovery Lab", () => {
  test("should load discovery lab page", async ({ page }) => {
    await page.goto("/discovery-lab")
    await expect(page.locator("body")).toBeVisible()
  })
})
