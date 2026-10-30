import type { Metadata } from "next";
import { HistoryList } from "@/components/features/history/HistoryList";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <HistoryList />;
}
