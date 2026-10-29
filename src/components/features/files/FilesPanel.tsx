"use client";

import { Download, FolderOpen, Loader2, Lock, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useCallSession } from "@/components/features/call/context";
import { formatBytes } from "@/lib/utils";
import { useCallStore } from "@/stores/callStore";
import { FileDropZone } from "./FileDropZone";
import { FileTypeIcon } from "./fileIcon";

export function FilesPanel() {
  const session = useCallSession();
  const files = useCallStore((s) => s.files);
  const input = useRef<HTMLInputElement>(null);
  const sorted = [...files].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <FileDropZone
      onFiles={(fs) => fs.forEach((f) => void session.shareFile(f))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-3">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<FolderOpen />}
            title="No files yet"
            description="Files are encrypted on your device before upload. Up to 50 MB each."
            className="h-full"
          />
        ) : (
          <ul className="space-y-2 py-2">
            {sorted.map((f) => (
              <li key={f.id} className="bg-card/60 rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-soft text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                    {f.status === "locked" ? (
                      <Lock className="size-5" />
                    ) : (
                      <FileTypeIcon type={f.type} name={f.name} className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" title={f.name}>
                      {f.name}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {formatBytes(f.size)} · {f.senderName} ·{" "}
                      {new Date(f.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  {f.status === "ready" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Download ${f.name}`}
                      onClick={() => void session.downloadFile(f.id)}
                    >
                      <Download />
                    </Button>
                  )}
                  {f.status === "downloading" && (
                    <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Downloading" />
                  )}
                </div>
                {f.status === "uploading" && (
                  <div className="mt-2.5">
                    <div
                      className="bg-muted h-1.5 overflow-hidden rounded-full"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(f.progress * 100)}
                      aria-label={`Uploading ${f.name}`}
                    >
                      <div
                        className="bg-primary h-full rounded-full transition-[width]"
                        style={{ width: `${Math.max(4, f.progress * 100)}%` }}
                      />
                    </div>
                    <div className="text-muted-foreground mt-1 text-[11px]">
                      Encrypting & uploading… {Math.round(f.progress * 100)}%
                    </div>
                  </div>
                )}
                {f.status === "failed" && <div className="text-destructive mt-2 text-xs">Upload failed</div>}
                {f.status === "locked" && (
                  <div className="text-muted-foreground mt-2 text-xs">
                    Shared before you had this meeting&apos;s key.
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t p-3">
        <Button variant="outline" className="w-full" onClick={() => input.current?.click()}>
          <Upload /> Share a file
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            Array.from(e.target.files ?? []).forEach((f) => void session.shareFile(f));
            e.target.value = "";
          }}
        />
      </div>
    </FileDropZone>
  );
}
