"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/misc";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  const { data: user, isPending } = useCurrentUser();
  return (
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-40 border-b border-transparent backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Meetspace home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
          <a href="#features" className="hover:text-foreground transition">
            Features
          </a>
          <a href="#security" className="hover:text-foreground transition">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isPending ? (
            <div className="h-8 w-24" />
          ) : user ? (
            <Button asChild size="sm">
              <Link href="/meetings">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
