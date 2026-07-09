import { expect, test, type Page } from "@playwright/test";

async function createLobby(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Player name").fill(name);
  await page.getByRole("button", { name: /create game/i }).click();
  await page.waitForURL("**/play");
  const code = await page
    .locator("span.font-mono", { hasText: /^[A-Z]{6}$/ })
    .first()
    .textContent();
  expect(code).toMatch(/^[A-Z]{6}$/);
  return code!;
}

test.describe("lobby multiplayer flow", () => {
  test("host creates a room and a second player joins via code", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const code = await createLobby(host, "HostBean");
    await expect(host.getByText("HostBean")).toBeVisible();
    await expect(host.getByText(/waiting|need/i)).toBeVisible();

    await guest.goto("/");
    await guest.getByLabel("Player name").fill("GuestBean");
    await guest.getByLabel("Room code").fill(code);
    await guest.getByRole("button", { name: /^join$/i }).click();
    await guest.waitForURL("**/play");

    // both clients see both players
    await expect(guest.getByText("HostBean")).toBeVisible({ timeout: 10_000 });
    await expect(host.getByText("GuestBean")).toBeVisible({ timeout: 10_000 });

    // guest readies up; host sees the state change
    await guest.getByRole("button", { name: /ready up/i }).click();
    await expect(host.getByText(/need 2 more/i)).toBeVisible();

    // lobby chat round-trips
    await guest.getByLabel("Chat message").fill("hello from guest");
    await guest.getByRole("button", { name: /^send$/i }).click();
    await expect(host.getByText("hello from guest")).toBeVisible({ timeout: 10_000 });

    await hostContext.close();
    await guestContext.close();
  });

  test("joining a nonexistent room shows an error", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Player name").fill("Lost");
    await page.getByLabel("Room code").fill("ZZZZZZ");
    await page.getByRole("button", { name: /^join$/i }).click();
    await expect(page.getByText(/room not found/i)).toBeVisible();
  });
});
