"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { UserDto } from "@/core/application/dtos";
import { useSetCurrentUser } from "@/hooks/useCurrentUser";
import { api, ApiError } from "@/lib/api-client";
import { loginSchema, registerSchema } from "@/lib/schemas/auth";

type Mode = "login" | "register";

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/meetings";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useSetCurrentUser();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = (mode === "login" ? loginSchema : registerSchema).safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { user } = await api<{ user: UserDto }>(`/api/auth/${mode}`, { method: "POST", body: parsed.data });
      setUser(user);
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (Object.keys(fe).length) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]])));
        if (err.code === "ACCOUNT_LOCKED" && typeof err.details.lockedUntil === "string") {
          const mins = Math.max(1, Math.ceil((Date.parse(err.details.lockedUntil) - Date.now()) / 60_000));
          setFormError(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
        } else setFormError(err.message);
      } else setFormError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const fieldProps = (name: string) => ({
    id: name,
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-3.5 py-2.5 text-sm"
        >
          {formError}
        </div>
      )}
      {mode === "register" && (
        <Field label="Your name" htmlFor="displayName" error={errors.displayName}>
          <Input {...fieldProps("displayName")} autoComplete="name" placeholder="Ada Lovelace" />
        </Field>
      )}
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input {...fieldProps("email")} type="email" autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password}
        hint={mode === "register" ? "At least 10 characters with a letter and a number." : undefined}
      >
        <div className="relative">
          <Input
            {...fieldProps("password")}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        {mode === "login" ? (
          <>
            New to Meetspace?{" "}
            <Link
              href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
              className="text-primary font-medium hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
