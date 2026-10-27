import Link from "next/link";
import { ThemeToggle } from "@/components/features/shell/ThemeToggle";
import { Logo } from "@/components/ui/misc";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
      />
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Meetspace home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
