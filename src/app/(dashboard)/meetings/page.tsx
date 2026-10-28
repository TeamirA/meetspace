import type { Metadata } from "next";
import { MeetingsDashboard } from "@/components/features/meetings/MeetingsDashboard";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return <MeetingsDashboard />;
}
