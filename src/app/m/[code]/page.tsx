import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingRoom } from "@/components/features/lobby/MeetingRoom";
import { isValidMeetingCode } from "@/core/domain/entities/Meeting";

export const metadata: Metadata = { title: "Meeting", robots: { index: false } };

export default async function MeetingPage({ params }: PageProps<"/m/[code]">) {
  const { code } = await params;
  if (!isValidMeetingCode(code)) notFound();
  return <MeetingRoom code={code} />;
}
