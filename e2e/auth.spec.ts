import { test, expect } from "@playwright/test"

test.describe("Authentication flows", () => {
  test("should load the login page", async ({ page }) => {
    await page.goto("/auth/signin")
    await expect(page).toHaveTitle(/Biozephyra|Sign In/i)
  })

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/auth/signin")
    await page.fill('input[name="email"], input[type="email"]', "nonexistent@example.com")
    await page.fill('input[name="password"], input[type="password"]', "wrongpassword")
    await page.click('button[type="submit"]')
    await expect(page.locator("text=/error|invalid|incorrect/i")).toBeVisible({ timeout: 10_000 })
  })

  test("should redirect unauthenticated user from dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForURL(/auth|signin|login/i, { timeout: 10_000 })
  })
})

test.describe("Public pages", () => {
  test("should load the home page", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Biozephyra/i)
  })

  test("should load the learn page", async ({ page }) => {
    await page.goto("/learn")
    await expect(page.locator("body")).toBeVisible()
  })

  test("should load community page", async ({ page }) => {
    await page.goto("/community")
    await expect(page.locator("body")).toBeVisible()
  })
})
