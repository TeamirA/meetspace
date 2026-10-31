import { expect, test } from "@playwright/test";
import { newUser, register } from "./helpers";

test("landing page explains the product and validates join codes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet, present and sketch together");
  await page.getByLabel("Meeting code or link").fill("not a code");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "abc-defg-hij" })).toBeVisible();
});

test("protected pages redirect to sign in", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login\?next=%2Fhistory/);
});

test("register, sign out and sign back in", async ({ page }) => {
  const user = newUser();
  await register(page, user);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.displayName.split(" ")[0]);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/meetings/);
});

test("schedule a meeting and get a calendar file", async ({ page }) => {
  await register(page, newUser("host"));
  await page.getByRole("button", { name: "Schedule" }).first().click();
  await page.getByLabel("Title").fill("Design review");
  await page.getByRole("dialog").getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByRole("dialog")).toContainText("Meeting scheduled");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Add to calendar" }).click();
  expect((await download).suggestedFilename()).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}\.ics$/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Design review")).toBeVisible();
});
