"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addRecentWorkbook } from "@/lib/format";
import type { UploadResponse } from "@/lib/schemas/workbook";

interface Sample {
  name: string;
  label: string;
  available: boolean;
}

/** Developer-only quick loader for the bundled fixture workbooks. */
export function SampleGallery() {
  const router = useRouter();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setSamples(d.samples ?? []))
      .catch(() => setSamples([])); // hidden in production
  }, []);

  if (samples.length === 0) return null;

  const load = async (name: string) => {
    setLoading(name);
    setError(null);
    try {
      const r = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "Failed to load sample");
      const res = body as UploadResponse;
      addRecentWorkbook({
        id: res.workbookId,
        filename: res.filename,
        uploadedAt: new Date().toISOString(),
        sheetCount: res.sheetCount,
        tableCount: res.tableCount,
      });
      router.push(`/workbooks/${res.workbookId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
      setLoading(null);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-muted-foreground">Try a sample workbook</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {samples.map((s) => (
          <Button
            key={s.name}
            variant="outline"
            size="sm"
            disabled={!s.available || loading !== null}
            onClick={() => load(s.name)}
          >
            {loading === s.name ? "Loading…" : s.label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
