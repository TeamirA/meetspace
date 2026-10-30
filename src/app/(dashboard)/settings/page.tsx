import type { Metadata } from "next";
import { SettingsView } from "@/components/features/settings/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsView />;
}
