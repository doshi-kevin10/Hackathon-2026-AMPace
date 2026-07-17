"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import {
  clearActivity,
  getActivity,
  getLastSeen,
  markSeen,
  subscribeActivity,
  timeAgo,
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/activity/log";

const ICON: Record<ActivityKind, string> = {
  "add-row": "＋",
  "delete-row": "🗑",
  "edit-cell": "✎",
  "add-column": "ƒ",
  "delete-column": "✕",
  download: "↓",
};

/** Topbar feed of local changes the user made to the data (rows, cells, columns) — nothing is written to Databricks. */
export function ActivityFeed() {
  const router = useRouter();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => {
      setEntries(getActivity());
      setLastSeen(getLastSeen());
    };
    refresh();
    return subscribeActivity(refresh);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = entries.filter((e) => new Date(e.at).getTime() > lastSeen).length;

  const toggle = () => {
    setOpen((o) => {
      if (!o) markSeen();
      return !o;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Recent updates${unread ? ` (${unread} new)` : ""}`}
        className="relative grid h-8 w-8 place-items-center rounded-lg border border-border bg-background hover:bg-muted"
      >
        <History className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Recent updates</span>
            {entries.length > 0 && (
              <button type="button" onClick={() => clearActivity()} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {entries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No changes yet. Edit a cell, add a row or a column and it shows up here.
              </p>
            ) : (
              entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(e.href);
                  }}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-muted text-xs text-muted-foreground" aria-hidden>
                    {ICON[e.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-snug">{e.message}</span>
                    <span className="block text-xs text-muted-foreground">
                      {e.label} · {timeAgo(e.at)}
                    </span>
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
