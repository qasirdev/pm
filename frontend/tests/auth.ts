import { Page, expect } from "@playwright/test";

export async function resetBoard(page: Page) {
  await page.request.post("/api/test/reset");
}

export async function login(page: Page) {
  await resetBoard(page);
  await page.goto("/");
  await page.getByLabel(/username/i).fill("user");
  await page.getByLabel(/password/i).fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
}
