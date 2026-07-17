"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Excel-style cell comment: a corner marker + a small popover to view/edit/delete the note. */
export function CellNote({
  note,
  accent = "var(--chart-4)",
  label,
  onChange,
}: {
  note?: string;
  accent?: string;
  label: string;
  onChange: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const hasNote = !!note?.trim();

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(note ?? "");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={hasNote ? `Edit note on ${label}` : `Add note to ${label}`}
            title={hasNote ? note : "Add note"}
            className={cn(
              "absolute top-0 right-0 z-[6] grid size-3.5 place-items-center",
              hasNote ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100 focus:opacity-100"
            )}
          />
        }
      >
        {hasNote ? (
          <span
            aria-hidden
            className="block size-0 border-t-[7px] border-l-[7px] border-l-transparent"
            style={{ borderTopColor: accent }}
          />
        ) : (
          <MessageSquarePlus className="size-3 text-muted-foreground" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">Note · {label}</p>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              onChange(draft);
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Add a note…"
          rows={3}
          className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {hasNote ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-destructive"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
