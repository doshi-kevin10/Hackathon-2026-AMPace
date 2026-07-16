"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addRecentWorkbook } from "@/lib/format";
import type { UploadResponse } from "@/lib/schemas/workbook";

const MAX_MB = 20; // client-side hint; the server enforces the real (configurable) limit

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number; filename: string }
  | { kind: "error"; message: string };

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const upload = useCallback(
    (file: File) => {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        setStatus({ kind: "error", message: `"${file.name}" is not an .xlsx or .xls file.` });
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setStatus({ kind: "error", message: `File is larger than the ${MAX_MB} MB limit.` });
        return;
      }

      setStatus({ kind: "uploading", progress: 0, filename: file.name });
      const form = new FormData();
      form.append("file", file);

      // XMLHttpRequest instead of fetch: it exposes upload progress events.
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/workbooks/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setStatus({ kind: "uploading", progress: e.loaded / e.total, filename: file.name });
        }
      };
      xhr.onerror = () => setStatus({ kind: "error", message: "Network error during upload." });
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) {
            setStatus({ kind: "error", message: body?.error?.message ?? "Upload failed." });
            return;
          }
          const res = body as UploadResponse;
          addRecentWorkbook({
            id: res.workbookId,
            filename: res.filename,
            uploadedAt: new Date().toISOString(),
            sheetCount: res.sheetCount,
            tableCount: res.tableCount,
          });
          router.push(`/workbooks/${res.workbookId}`);
        } catch {
          setStatus({ kind: "error", message: "Unexpected server response." });
        }
      };
      xhr.send(form);
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload]
  );

  const uploading = status.kind === "uploading";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload an Excel workbook"
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          uploading && "pointer-events-none opacity-70"
        )}
      >
        <div className="rounded-full bg-muted p-4 text-2xl" aria-hidden>
          📄
        </div>
        {uploading ? (
          <>
            <p className="font-medium">Uploading {status.filename}…</p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.round(status.progress * 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {status.progress >= 1 ? "Parsing workbook…" : `${Math.round(status.progress * 100)}%`}
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">Drop an Excel workbook here</p>
            <p className="text-sm text-muted-foreground">
              .xlsx or .xls, up to {MAX_MB} MB — or click to browse
            </p>
            <Button variant="secondary" size="sm" tabIndex={-1}>
              Choose file
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>

      {status.kind === "error" && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
