import { expect, test } from "@playwright/test";

test.describe("home screen", () => {
  test("renders the landing page with play controls", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Crewfall/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/CREW/i);
    await expect(page.getByLabel("Player name")).toBeVisible();
    await expect(page.getByRole("button", { name: /create game/i })).toBeVisible();
    await expect(page.getByLabel("Room code")).toBeVisible();
  });

  test("requires a name before creating a game", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Player name").fill("");
    await page.getByRole("button", { name: /create game/i }).click();
    await expect(page.getByText(/pick a name/i)).toBeVisible();
  });

  test("theme toggle switches between dark and light", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
    await page.getByRole("button", { name: /switch to light mode/i }).click();
    await expect(html).toHaveClass(/light/);
  });

  test("leaderboard page renders without a database", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible();
  });
});
