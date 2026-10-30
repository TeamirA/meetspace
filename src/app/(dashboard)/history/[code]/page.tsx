import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDetails } from "@/components/features/history/MeetingDetails";
import { isValidMeetingCode } from "@/core/domain/entities/Meeting";

export const metadata: Metadata = { title: "Meeting details" };

export default async function MeetingDetailsPage({ params }: PageProps<"/history/[code]">) {
  const { code } = await params;
  if (!isValidMeetingCode(code)) notFound();
  return <MeetingDetails code={code} />;
}
