"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { AmpaceChat } from "@/components/agent/ampace-chat";
import { SlackBot } from "@/components/agent/slack-bot";
import { NewsDrawer } from "@/components/news/news-drawer";
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
    <header className="shrink-0 border-b bg-card">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">A</span>
          AMPulse
        </Link>
        <span className="hidden text-xs text-muted-foreground sm:inline">AI automation for ad performance</span>

        <div className="ml-auto flex items-center gap-3">
          <AmpaceChat />
          <SlackBot />
          <NewsDrawer />
          <ActivityFeed />
          <span className="hidden text-sm text-muted-foreground md:inline">{user.name}</span>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
