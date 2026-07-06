import { expect, test } from "@playwright/test";
import { login } from "./auth";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("AI chat creates a card and the board updates live", async ({ page }) => {
  await page.getByRole("button", { name: /open chat/i }).click();

  const chatInput = page.getByPlaceholder(/ask the assistant/i);
  await chatInput.fill(
    "Add a card called E2E chat card to the Discovery column."
  );
  await page.getByRole("button", { name: /send/i }).click();

  const discoveryColumn = page.getByTestId(/column-/).nth(1);
  await expect(discoveryColumn.getByText("E2E chat card")).toBeVisible({
    timeout: 20_000,
  });
});
