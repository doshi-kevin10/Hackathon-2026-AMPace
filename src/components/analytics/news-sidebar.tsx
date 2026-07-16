"use client";

import { Newspaper } from "lucide-react";
import type { NewsItemView } from "@/lib/schemas/monitor";
import { cn } from "@/lib/utils";

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(0, Math.round(ms / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/** Flagged-relevant headlines first (red), then everything else (black) — recency preserved within each group. */
function sortNews(news: NewsItemView[]): NewsItemView[] {
  return [...news].sort((a, b) => Number(b.relevant === true) - Number(a.relevant === true));
}

export function NewsSidebar({ news }: { news: NewsItemView[] }) {
  const sorted = sortNews(news);

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-semibold">News</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent headlines found.</p>
      ) : (
        <div className="grid gap-2">
          {sorted.map((n, i) => (
            <a
              key={i}
              href={n.link}
              target="_blank"
              rel="noreferrer"
              title={n.reason ?? undefined}
              className={cn(
                "flex gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/40",
                n.relevant ? "border-red-300 dark:border-red-900" : "border-border"
              )}
            >
              {n.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external, unsized source; next/image would need a remotePatterns allowlist for an arbitrary news host
                <img src={n.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Newspaper className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <p className={cn("line-clamp-2 text-xs font-medium", n.relevant ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                  {n.title}
                </p>
                {n.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.snippet}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {n.source ?? "Unknown source"} · {timeAgo(n.publishedAt)}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
