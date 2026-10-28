import { AppShell } from "@/components/features/shell/AppShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
