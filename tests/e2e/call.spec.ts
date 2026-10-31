import { expect, test, type Browser } from "@playwright/test";
import { newUser, realtimeConfigured, register } from "./helpers";

test.skip(!realtimeConfigured(), "Needs SUPABASE_JWT_SECRET and SUPABASE_SERVICE_ROLE_KEY for Realtime");

async function signedInPage(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await register(page, newUser(prefix));
  return { context, page };
}

test("host admits a guest from the waiting room; they see each other, chat and draw", async ({ browser }) => {
  const host = await signedInPage(browser, "host");
  await host.page.getByRole("button", { name: "New meeting" }).click();
  await host.page.getByRole("menuitem", { name: "Start an instant meeting" }).click();
  await expect(host.page).toHaveURL(/\/m\/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
  const url = host.page.url();

  // Lobby preview uses the fake camera.
  await expect(host.page.getByLabel("Your camera preview")).toBeVisible();
  await host.page.getByRole("button", { name: "Start meeting" }).click();
  await expect(host.page.getByRole("toolbar", { name: "Call controls" })).toBeVisible();

  const member = await signedInPage(browser, "member");
  await member.page.goto(url);
  await member.page.getByRole("button", { name: "Join meeting" }).click();
  await expect(member.page.getByText("Waiting for the host")).toBeVisible();

  const stage = host.page.getByRole("main", { name: "Meeting stage" });
  await expect(stage.getByText("wants to join")).toBeVisible();
  await stage.getByRole("button", { name: "Admit" }).click();
  await expect(member.page.getByRole("toolbar", { name: "Call controls" })).toBeVisible({ timeout: 20_000 });

  // Both sides see two camera tiles once the peer connection is up.
  for (const p of [host.page, member.page]) {
    await expect(p.locator('[role="group"][aria-label]').filter({ has: p.locator("video") })).toHaveCount(2, {
      timeout: 30_000,
    });
  }

  // Encrypted chat goes both ways once keys are exchanged.
  await expect(member.page.getByRole("button", { name: /Encrypted|end-to-end/i }).first()).toBeVisible({
    timeout: 20_000,
  });
  await member.page.keyboard.press("c");
  await member.page.getByRole("textbox", { name: "Message" }).fill("hello from the member");
  await member.page.getByRole("textbox", { name: "Message" }).press("Enter");
  await host.page.keyboard.press("c");
  await expect(host.page.getByText("hello from the member")).toBeVisible({ timeout: 15_000 });

  // Mic toggle is reflected for the other participant.
  await host.page.keyboard.press("Escape");
  await host.page.keyboard.press("m");
  await expect(member.page.getByLabel("Muted").first()).toBeVisible({ timeout: 10_000 });

  // Host ends the meeting for everyone.
  await host.page.getByRole("button", { name: "Leave or end meeting" }).click();
  await host.page.getByRole("menuitem", { name: "End meeting for everyone" }).click();
  await expect(member.page.getByText("The host ended the meeting")).toBeVisible({ timeout: 15_000 });

  await host.context.close();
  await member.context.close();
});
