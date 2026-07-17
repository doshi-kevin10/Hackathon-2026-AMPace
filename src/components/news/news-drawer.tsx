"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw, X } from "lucide-react";
import { prettify, useCompanyContext } from "@/components/agent/chat-drawer";
import { Button } from "@/components/ui/button";

interface NewsItem {
  title: string;
  link: string;
  publishedAt: string;
  source: string | null;
  snippet: string | null;
  imageUrl: string | null;
}
interface Dataset {
  name: string;
  label: string;
}
type NewsResult = { key: string; items?: NewsItem[]; error?: string };

/** "2h ago" style relative time; empty string for missing/epoch dates. */
const relTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (!then || then <= 0) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Article thumbnail — real image when the feed carries one, else a branded placeholder. */
function Thumb({ src, source }: { src: string | null; source: string | null }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    // eslint-disable-next-line @next/next/no-img-element -- remote RSS images, plain img avoids next/image domain config
    return <img src={src} alt="" onError={() => setErr(true)} loading="lazy" className="size-16 shrink-0 rounded-md object-cover" />;
  }
  return (
    <div className="grid size-16 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary/15 to-primary/5 text-base font-semibold text-primary">
      {(source ?? "N").charAt(0).toUpperCase()}
    </div>
  );
}

/** Header drawer (beside the chatbots): latest company-specific news, with links and images. */
export function NewsDrawer() {
  const { company: urlCompany } = useCompanyContext();
  const [open, setOpen] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [override, setOverride] = useState<string | null>(null); // company the user picked from the dropdown
  const [result, setResult] = useState<NewsResult | null>(null);
  const [nonce, setNonce] = useState(0);

  // The selection is derived: an explicit pick wins, else the URL's company, else the first dataset.
  const selected = override ?? urlCompany ?? datasets[0]?.name ?? null;
  const label = selected ? datasets.find((d) => d.name === selected)?.label ?? prettify(selected) : null;
  const key = label ? `${label}#${nonce}` : null;

  const loading = open && !!key && result?.key !== key;
  const items = result?.key === key ? result.items ?? null : null;
  const error = result?.key === key ? result.error ?? null : null;

  // Company list for the picker (loaded when the drawer opens). setState only in the callback.
  useEffect(() => {
    if (!open) return;
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((b) => setDatasets((b.datasets ?? []) as Dataset[]))
      .catch(() => {});
  }, [open]);

  // News for the selected company. setState only inside the async callbacks (lint-safe).
  useEffect(() => {
    if (!open || !label || !key) return;
    const c = new AbortController();
    fetch(`/api/news?company=${encodeURIComponent(label)}`, { signal: c.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? "Failed to load news");
        if (!c.signal.aborted) setResult({ key, items: (b.items ?? []) as NewsItem[] });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setResult({ key, error: "Couldn't load news right now." });
      });
    return () => c.abort();
  }, [open, label, key]);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Newspaper className="size-4" /> News
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <Newspaper className="size-4 text-primary" />
              <span className="font-semibold">News</span>
              <span className="truncate text-xs text-muted-foreground">{label ? `latest on ${label}` : "pick a company"}</span>
              <button
                type="button"
                onClick={() => setNonce((n) => n + 1)}
                className="ml-auto rounded-md p-1 hover:bg-muted disabled:opacity-40"
                aria-label="Refresh"
                disabled={loading || !label}
                title="Refresh"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </header>

            <div className="border-b px-4 py-2.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Company
                <select
                  value={selected ?? ""}
                  onChange={(e) => setOverride(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {datasets.length === 0 && selected && <option value={selected}>{label}</option>}
                  {datasets.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
              {!label && <p className="text-sm text-muted-foreground">Pick a company to see its latest news.</p>}
              {loading && <p className="text-sm text-muted-foreground">Fetching the latest headlines…</p>}
              {error && !loading && <p className="text-sm text-destructive">{error}</p>}
              {!loading && !error && items?.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent news found for {label}.</p>
              )}
              {!loading &&
                !error &&
                items?.map((item, i) => (
                  <a
                    key={`${item.link}-${i}`}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50"
                  >
                    <Thumb src={item.imageUrl} source={item.source} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{item.title}</p>
                      {item.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.snippet}</p>}
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="truncate">{item.source ?? "News"}</span>
                        {relTime(item.publishedAt) && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="shrink-0">{relTime(item.publishedAt)}</span>
                          </>
                        )}
                        <ExternalLink className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </p>
                    </div>
                  </a>
                ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
