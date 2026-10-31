import { expect, type Page } from "@playwright/test";

export function newUser(prefix = "e2e") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    email: `${prefix}-${id}@meetspace.test`,
    password: `Pw-${id}-9x`,
    displayName: `${prefix === "host" ? "Hannah" : "Sam"} ${id.slice(-4)}`,
  };
}

export async function register(page: Page, user: ReturnType<typeof newUser>) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/meetings/);
}

export const realtimeConfigured = () =>
  Boolean(process.env.SUPABASE_JWT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
