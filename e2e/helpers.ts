import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const RUN = Date.now().toString(36);

/** Connaught Place, New Delhi. Finder is ~300 m away. */
export const OWNER_GEO = { latitude: 28.6315, longitude: 77.2167 };
export const FINDER_GEO = { latitude: 28.6334, longitude: 77.2191 };

export interface Actor {
  context: BrowserContext;
  page: Page;
  name: string;
  email: string;
  password: string;
}

export async function newActor(browser: Browser, name: string, geo: { latitude: number; longitude: number }, baseURL?: string): Promise<Actor> {
  const context = await browser.newContext({ geolocation: geo, permissions: ["geolocation"], baseURL });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log(`[${name} pageerror]`, err.message));
  const email = `e2e-${name.toLowerCase()}-${RUN}@lostlink.test`;
  return { context, page, name, email, password: `pw-${RUN}-secure` };
}

export async function signUp(a: Actor) {
  await a.page.goto("/signup");
  await a.page.getByLabel("Your name").fill(`${a.name} Tester`);
  await a.page.getByLabel("Email").fill(a.email);
  await a.page.getByLabel("Password").fill(a.password);
  await a.page.getByRole("button", { name: "Create account" }).click();
  await a.page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
  await expect(a.page.getByRole("link", { name: /Notifications/ })).toBeVisible();
}

/** Delete the test account (and everything it owns) through the real API. */
export async function deleteAccount(a: Actor) {
  const res = await a.page.request.delete("/api/auth/account", { data: { confirm: "DELETE" } });
  expect([200, 401]).toContain(res.status());
}

export async function useMyLocation(page: Page) {
  await page.getByRole("button", { name: "Use my location" }).first().click();
  await expect(page.getByLabel("Place name")).toBeVisible({ timeout: 30_000 });
}

/** Wait until the page is connected to Nexconn (real-time delivery ready). */
export async function waitForChat(page: Page) {
  await expect(page.locator('[data-chat-status="connected"]')).toHaveCount(1, { timeout: 90_000 });
}

/** Save a review screenshot to docs/screenshots when SCREENSHOTS=1. */
export async function shot(page: Page, name: string) {
  if (process.env.SCREENSHOTS !== "1") return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: false });
}
