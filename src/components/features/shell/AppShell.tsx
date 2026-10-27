"use client";

import { CalendarDays, History, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo, Skeleton } from "@/components/ui/misc";
import { useCurrentUser, useSetCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, isPending } = useCurrentUser();
  const setUser = useSetCurrentUser();

  useEffect(() => {
    if (!isPending && user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isPending, user, pathname, router]);

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="bg-background/75 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/meetings" aria-label="Meetspace dashboard">
            <Logo />
          </Link>
          <nav aria-label="Dashboard" className="hidden items-center gap-1 md:flex">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Account menu"
                  className="ring-offset-background rounded-full ring-offset-2"
                >
                  <Avatar name={user.displayName} src={user.avatarUrl} size={34} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>
                    <div className="text-foreground text-sm font-medium">{user.displayName}</div>
                    <div className="truncate font-normal">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/settings")}>
                    <Settings /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={signOut}>
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Skeleton className="size-[34px] rounded-full" />
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
      <nav
        aria-label="Dashboard"
        className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
