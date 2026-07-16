"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/config";

export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">A</span>
          AMPulse
        </Link>
        <span className="text-sm text-muted-foreground">Live advertising analytics</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user.name} · <span className="text-xs uppercase">{user.role.replace("_", " ")}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
