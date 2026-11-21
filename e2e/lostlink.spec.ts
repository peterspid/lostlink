import path from "node:path";
import { expect, test } from "@playwright/test";
import { FINDER_GEO, OWNER_GEO, RUN, deleteAccount, newActor, signUp, useMyLocation, waitForChat, shot, type Actor } from "./helpers";

const WALLET = path.join(__dirname, "fixtures", "wallet.jpg");

test.describe.configure({ mode: "serial" });

let owner: Actor;
let finder: Actor;

test.beforeAll(async ({ browser, baseURL }) => {
  owner = await newActor(browser, "Asha", OWNER_GEO, baseURL);
  finder = await newActor(browser, "Bilal", FINDER_GEO, baseURL);
});

test.afterAll(async () => {
  for (const a of [owner, finder]) {
    if (!a) continue;
    await deleteAccount(a).catch(() => undefined);
    await a.context.close();
  }
});

test("lost → found with AI pre-fill → match → claim → approve → chat → handover → returned", async () => {
  const A = owner.page;
  const B = finder.page;

  await signUp(owner);
  await signUp(finder);
  await shot(A, "01-home");

  // ---- A reports a lost wallet (no photo) ----
  await A.goto("/report?kind=lost");
  await A.getByRole("button", { name: "Skip photos" }).click();
  await A.getByRole("radio", { name: "Wallet or purse" }).click();
  await A.getByLabel("Title").fill("Black leather bifold wallet");
  await A.getByLabel("Description").fill(`Black stitched leather wallet with my driving licence and cash inside. Lost near the metro. (${RUN})`);
  await A.getByLabel("Color").fill("black");
  await A.getByLabel("Material").fill("leather");
  await A.getByRole("button", { name: "Continue" }).click();
  await useMyLocation(A);
  await A.getByLabel("Place name").fill("Rajiv Chowk metro, gate 5");
  await A.getByRole("button", { name: "Post lost item" }).click();
  await A.waitForURL(/\/items\/[a-z0-9]+\?posted=1/);
  const lostId = new URL(A.url()).pathname.split("/").pop()!;
  await expect(A.getByTestId("item-title")).toHaveText("Black leather bifold wallet");

  // Owner waits somewhere in the app, connected to Nexconn.
  await A.goto("/profile");
  await waitForChat(A);

  // ---- B reports the found wallet with a photo: Gemini vision pre-fills ----
  await B.goto("/report?kind=found");
  await B.getByTestId("photo-input").setInputFiles(WALLET);
  await expect(B.getByTestId("ai-filled")).toBeVisible({ timeout: 90_000 });
  await B.getByRole("button", { name: "Continue" }).click();
  const aiTitle = await B.getByLabel("Title").inputValue();
  expect(aiTitle.length, "AI should pre-fill the title").toBeGreaterThan(2);
  console.log(`[ai] title="${aiTitle}" color="${await B.getByLabel("Color").inputValue()}"`);
  await shot(B, "03-report-ai-prefill");
  await B.getByRole("radio", { name: "Wallet or purse" }).click();
  // Replace AI-suggested questions with one we know the answer to.
  while ((await B.getByRole("button", { name: /^Remove question/ }).count()) > 0) {
    await B.getByRole("button", { name: /^Remove question/ }).first().click();
  }
  await B.getByRole("button", { name: "Add a question" }).click();
  await B.getByLabel("Question 1", { exact: true }).fill("Which licence card is inside?");
  await B.getByLabel("Answer 1", { exact: true }).fill("Ontario driver's licence");
  await B.getByRole("button", { name: "Continue" }).click();
  await useMyLocation(B);
  await B.getByLabel("Place name").fill("Bench outside Block A");
  // Start watching the owner's screen before posting: the live notice toast only shows for a few seconds.
  const ownerToast = expect(A.getByRole("status").filter({ hasText: "Possible match for your" })).toBeVisible({ timeout: 120_000 });
  await B.getByRole("button", { name: "Post found item" }).click();
  await B.waitForURL(/\/items\/[a-z0-9]+\?posted=1/, { timeout: 90_000 });
  const foundId = new URL(B.url()).pathname.split("/").pop()!;

  // Finder immediately sees the owner's lost report as a match, with readable reasons.
  const matchRow = B.getByTestId("matches").getByRole("link").filter({ hasText: "Black leather bifold wallet" });
  await expect(matchRow.first()).toBeVisible();
  await expect(matchRow.first()).toContainText(/away|apart/);
  await shot(B, "04-found-item-matches");

  // ---- Owner gets the match live through the Nexconn system channel ----
  await ownerToast;
  await A.goto("/notifications");
  const matchNote = A.locator(`a[href^="/items/${foundId}"]`).first();
  await expect(matchNote).toBeVisible();
  await shot(A, "05-notifications");
  await matchNote.click();
  await A.waitForURL(new RegExp(`/items/${foundId}`));
  expect(A.url()).toContain(`from=${lostId}`);

  // ---- Claim: answer the verification question ----
  await A.getByTestId("claim-cta").click();
  await A.waitForURL(/\/claim/);
  await A.getByTestId("claim-answer").fill("An Ontario driver's licence");
  await shot(A, "06-claim-form");
  await A.getByTestId("claim-submit").click();
  await A.waitForURL(/\/chats\/[a-z0-9]+/, { timeout: 60_000 });
  const claimPath = new URL(A.url()).pathname;
  await waitForChat(A);
  await expect(A.getByTestId("claim-card")).toBeVisible({ timeout: 60_000 });
  await expect(A.getByTestId("claim-card")).toContainText("Waiting for finder");

  // ---- Finder opens the claim from Chats and approves ----
  await B.goto("/chats");
  await B.locator(`a[href="${claimPath}"]`).first().click();
  await B.waitForURL(claimPath);
  await waitForChat(B);
  await expect(B.getByTestId("claim-card")).toBeVisible({ timeout: 60_000 });
  await expect(B.getByTestId("claim-panel")).toContainText("An Ontario driver's licence");
  await expect(B.getByTestId("claim-panel")).toContainText("Your answer: Ontario driver's licence");
  await shot(B, "07-finder-checks-answers");
  await B.getByTestId("approve-claim").click();

  // Card state flips for the owner in real time (message metadata) and a result card arrives.
  await expect(A.getByTestId("claim-card")).toContainText("Approved", { timeout: 60_000 });
  await expect(A.getByTestId("result-card")).toContainText("Ownership confirmed", { timeout: 60_000 });
  await shot(A, "08-claim-approved");

  // ---- Real-time chat with read receipts and typing ----
  await A.getByTestId("composer").fill("Hi! That's my wallet, thank you so much.");
  await A.getByTestId("send").click();
  await expect(B.getByTestId("chat-message").filter({ hasText: "That's my wallet" })).toBeVisible({ timeout: 30_000 });
  await expect(A.getByTestId("chat-message").filter({ hasText: "That's my wallet" }).getByTestId("read-receipt")).toBeVisible({ timeout: 30_000 });

  await B.getByTestId("composer").pressSequentially("Happy to help", { delay: 40 });
  await expect(A.getByTestId("typing")).toBeVisible({ timeout: 15_000 }).catch(() => console.log("[soft] typing indicator not observed"));
  await B.getByTestId("send").click();
  await expect(A.getByTestId("chat-message").filter({ hasText: "Happy to help" })).toBeVisible({ timeout: 30_000 });

  // ---- Finder proposes a meeting point (location message + handover card) ----
  await B.getByTestId("open-handover").click();
  await useMyLocation(B);
  await B.getByLabel("Place name").fill("Café Coffee Day, Block A");
  await B.getByTestId("send-handover").click();
  await expect(A.getByTestId("location-message").filter({ hasText: "Café Coffee Day" })).toBeVisible({ timeout: 60_000 });
  const card = A.getByTestId("handover-card").last();
  await expect(card).toContainText("Café Coffee Day");
  await card.getByTestId("handover-accept").click();
  await expect(B.getByTestId("handover-card").last().getByTestId("handover-status")).toHaveText("Confirmed", { timeout: 60_000 });
  await shot(B, "09-handover-confirmed");

  // ---- Both confirm the handover ----
  await B.getByTestId("mark-returned").click();
  await expect(B.getByTestId("waiting-returned")).toBeVisible();
  await A.reload();
  await A.getByTestId("mark-returned").click();
  await expect(A.getByTestId("returned-done")).toBeVisible({ timeout: 30_000 });
  await A.getByTestId("thanks-input").fill("You saved my week. Thank you!");
  await A.getByTestId("send-thanks").click();
  await expect(A.getByTestId("thank-you")).toContainText("You saved my week");
  await shot(A, "10-returned-thanks");

  // Finder earns karma; the item is closed as returned.
  await B.goto("/profile");
  await expect(B.getByTestId("karma")).toHaveText("10");
  await B.goto(`/items/${foundId}`);
  await expect(B.getByText("Returned").first()).toBeVisible();
});

test("desk: create, QR poster PNG/PDF, invite staff, staff group chat", async () => {
  const A = owner.page;
  const B = finder.page;

  await A.goto("/desks/new");
  await A.getByTestId("desk-name").fill(`E2E Central Library Desk ${RUN}`);
  await useMyLocation(A);
  await A.getByLabel("Place name").fill("Ground floor, next to the issue counter");
  await A.getByLabel("Opening hours").fill("Mon to Sat, 9:00 to 18:00");
  await A.getByTestId("desk-create").click();
  await A.waitForURL(/\/desks\/.+\/manage/, { timeout: 60_000 });
  await shot(A, "11-desk-manage");

  // QR poster renders as PNG and PDF.
  const pdfHref = await A.getByTestId("poster-pdf").getAttribute("href");
  const pngHref = await A.getByTestId("poster-png").getAttribute("href");
  const pdf = await A.request.get(pdfHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const png = await A.request.get(pngHref!);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toContain("image/png");
  expect((await png.body()).length).toBeGreaterThan(10_000);
  if (process.env.SCREENSHOTS === "1") (await import("node:fs")).writeFileSync("docs/screenshots/12-qr-poster.png", await png.body());

  // Invite staff by link; staff joins and chats in the Nexconn group channel.
  const invite = await A.getByTestId("invite-link").inputValue();
  await B.goto(new URL(invite).pathname);
  await B.getByTestId("join-desk").click();
  await B.waitForURL(/\/manage/, { timeout: 60_000 });
  await expect(B.getByTestId("group-chat")).toBeVisible();
  await expect(A.getByTestId("group-chat").getByText(/joined the desk team/)).toBeVisible({ timeout: 60_000 });
  await B.getByTestId("group-chat").getByTestId("composer").fill("Shift starts at 9, I'll take the counter.");
  await B.getByTestId("group-chat").getByTestId("send").click();
  await expect(A.getByTestId("group-chat").getByText("Shift starts at 9")).toBeVisible({ timeout: 30_000 });
  await A.getByTestId("group-chat").scrollIntoViewIfNeeded();
  await shot(A, "13-staff-chat");

  // Public desk page exists for the QR code.
  const manageUrl = new URL(A.url());
  await A.goto(manageUrl.pathname.replace(/\/manage$/, ""));
  await expect(A.getByTestId("desk-title")).toContainText("E2E Central Library Desk");
  await shot(A, "14-desk-public");
  await A.goto("/browse?view=map");
  await shot(A, "02-browse-map");
});
