"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function FileDropZone({
  onFiles,
  children,
  className,
}: {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(0);
  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) setOver((n) => n + 1);
      }}
      onDragLeave={() => setOver((n) => Math.max(0, n - 1))}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setOver(0);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {over > 0 && (
        <div className="border-primary bg-primary/10 text-primary pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium backdrop-blur-sm">
          <Upload className="size-6" /> Drop to share encrypted
        </div>
      )}
    </div>
  );
}
