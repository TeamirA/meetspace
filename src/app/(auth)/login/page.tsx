import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/features/auth/AuthForm";
import { Card, Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">Sign in to start or join your meetings.</p>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <AuthForm mode="login" />
      </Suspense>
    </Card>
  );
}
