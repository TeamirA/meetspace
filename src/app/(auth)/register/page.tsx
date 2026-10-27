import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/features/auth/AuthForm";
import { Card, Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">It takes less than a minute.</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AuthForm mode="register" />
      </Suspense>
    </Card>
  );
}
