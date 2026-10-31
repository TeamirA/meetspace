import { expect, test } from "@playwright/test";
import { newUser, register } from "./helpers";

test("dashboard uses the bottom navigation on phones", async ({ page }) => {
  await register(page, newUser());
  const bottomNav = page.getByRole("navigation", { name: "Dashboard" }).last();
  await expect(bottomNav).toBeVisible();
  await bottomNav.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Meeting history" })).toBeVisible();
});
