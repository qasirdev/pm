import { expect, test } from "@playwright/test";
import { login } from "./auth";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  const columns = page.locator('[data-testid^="column-"]');
  const firstColumn = columns.first();
  const targetColumn = columns.nth(3);

  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Draggable card");
  await firstColumn.getByPlaceholder("Details").fill("Move me.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();

  const card = firstColumn.locator('[data-testid^="card-"]', {
    hasText: "Draggable card",
  });
  await expect(card).toBeVisible();
  await card.hover();
  await page.waitForTimeout(300);

  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    cardBox.x + cardBox.width / 2 + 10,
    cardBox.y + cardBox.height / 2 + 10,
    { steps: 5 }
  );
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByText("Draggable card")).toBeVisible();
});

test("reordering cards within a column persists across reload", async ({
  page,
}) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();

  for (const title of ["Card A", "Card B", "Card C"]) {
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill(title);
    await firstColumn.getByRole("button", { name: /add card/i }).click();
  }
  await expect(firstColumn.getByText("Card C")).toBeVisible();

  const cardC = firstColumn.locator('[data-testid^="card-"]', {
    hasText: "Card C",
  });
  const cardA = firstColumn.locator('[data-testid^="card-"]', {
    hasText: "Card A",
  });

  const cardCBox = await cardC.boundingBox();
  const cardABox = await cardA.boundingBox();
  if (!cardCBox || !cardABox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  const [patchResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/api\/cards\/.+/.test(response.url()) &&
        response.request().method() === "PATCH"
    ),
    (async () => {
      await page.mouse.move(
        cardCBox.x + cardCBox.width / 2,
        cardCBox.y + cardCBox.height / 2
      );
      await page.mouse.down();
      const steps = 20;
      const startX = cardCBox.x + cardCBox.width / 2;
      const startY = cardCBox.y + cardCBox.height / 2;
      const endX = cardABox.x + cardABox.width / 2;
      const endY = cardABox.y + 5;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(
          startX + (endX - startX) * (i / steps),
          startY + (endY - startY) * (i / steps)
        );
      }
      await page.mouse.up();
    })(),
  ]);
  expect(patchResponse.ok()).toBe(true);

  await expect(async () => {
    const titles = await firstColumn.locator("h4").allTextContents();
    expect(titles).toEqual(["Card C", "Card A", "Card B"]);
  }).toPass();

  await page.reload();

  const reloadedFirstColumn = page.locator('[data-testid^="column-"]').first();
  await expect(reloadedFirstColumn.getByText("Card C")).toBeVisible();
  const titlesAfterReload = await reloadedFirstColumn
    .locator("h4")
    .allTextContents();
  expect(titlesAfterReload).toEqual(["Card C", "Card A", "Card B"]);
});

test("persists changes across a page reload", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persisted card");
  await firstColumn.getByPlaceholder("Details").fill("Should survive reload.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Persisted card")).toBeVisible();

  await page.reload();

  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(
    page.locator('[data-testid^="column-"]').first().getByText("Persisted card")
  ).toBeVisible();
});
