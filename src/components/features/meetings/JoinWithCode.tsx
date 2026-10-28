"use client";

import { ArrowRight, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeMeetingCode } from "@/core/domain/entities/Meeting";
import { cn } from "@/lib/utils";

export function JoinWithCode({ className, size = "default" }: { className?: string; size?: "default" | "lg" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeMeetingCode(value);
    if (!code) return setError("Enter a code like abc-defg-hij or paste a meeting link.");
    router.push(`/m/${code}`);
  };

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <input
            aria-label="Meeting code or link"
            aria-invalid={!!error}
            aria-describedby={error ? "join-code-error" : undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Enter a code or link"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "border-input bg-background/60 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/20 w-full rounded-xl border pr-3 pl-10 text-sm transition focus-visible:ring-4 focus-visible:outline-none",
              size === "lg" ? "h-12" : "h-10",
            )}
          />
        </div>
        <Button type="submit" variant="secondary" size={size === "lg" ? "lg" : "default"} disabled={!value.trim()}>
          Join <ArrowRight />
        </Button>
      </div>
      {error && (
        <p id="join-code-error" role="alert" className="text-destructive mt-2 text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
