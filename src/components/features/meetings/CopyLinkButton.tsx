"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { meetingUrl } from "@/lib/utils";

export function CopyLinkButton({
  code,
  label = "Copy link",
  ...props
}: { code: string; label?: string } & ButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl(code));
      setCopied(true);
      toast.success("Meeting link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} {...props}>
      {copied ? <Check className="text-success" /> : <Link2 />}
      {label}
    </Button>
  );
}
