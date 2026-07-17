"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { Notification, Severity } from "@/lib/notifications/watchtower";

const DOT: Record<Severity, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  positive: "bg-emerald-500",
  info: "bg-muted-foreground",
};

/** Topbar watchtower: accurate, deterministic cross-company alerts. Click → jump to the company. */
export function NotificationsBell() {
  const router = useRouter();
  const [notes, setNotes] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => active && setNotes(d.notifications ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const urgent = notes.filter((n) => n.severity === "critical" || n.severity === "warning").length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${urgent ? ` (${urgent} need attention)` : ""}`}
        className="relative grid h-8 w-8 place-items-center rounded-lg border border-border bg-background hover:bg-muted"
      >
        <Bell className="size-4" />
        {urgent > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {urgent}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <span className="text-xs text-muted-foreground">{notes.length ? `${urgent} need attention` : "all clear"}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {notes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No alerts — every account looks healthy.</p>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(n.href);
                  }}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.severity]}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    <span className="block text-xs text-muted-foreground">{n.detail}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
