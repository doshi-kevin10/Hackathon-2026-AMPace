import { useEffect, useState } from "react";
import type { MonitorResponse } from "@/lib/schemas/monitor";

const POLL_MS = 45_000;

/** Polls the news/anomaly monitor for one dataset. Shared by CompanyMonitor and NewsSidebar. */
export function useMonitor(datasetName: string) {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      fetch(`/api/datasets/${datasetName}/monitor`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body?.error?.message ?? "Monitor request failed");
          if (!cancelled) {
            setData(body);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to check for updates");
        });
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [datasetName]);

  return { data, error };
}
