"use client";

import { Badge } from "@/components/ui/badge";
import type { ParsedSheet } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

interface SheetSidebarProps {
  sheets: ParsedSheet[];
  selected: number;
  onSelect: (index: number) => void;
}

export function SheetSidebar({ sheets, selected, onSelect }: SheetSidebarProps) {
  return (
    <nav
      aria-label="Sheets"
      className="flex gap-1 overflow-x-auto pb-2 lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      {sheets.map((sheet) => (
        <button
          key={sheet.id}
          type="button"
          onClick={() => onSelect(sheet.index)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
            selected === sheet.index
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
            sheet.visibility !== "visible" && selected !== sheet.index && "opacity-60"
          )}
        >
          <span className="max-w-36 truncate font-medium" title={sheet.name}>
            {sheet.name}
          </span>
          {sheet.visibility !== "visible" && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {sheet.visibility === "veryHidden" ? "very hidden" : "hidden"}
            </Badge>
          )}
          <Badge
            variant={selected === sheet.index ? "outline" : "secondary"}
            className={cn(
              "ml-auto h-5 px-1.5 text-[11px]",
              selected === sheet.index && "border-primary-foreground/40 text-primary-foreground"
            )}
            title={`${sheet.tables.length} detected table(s)`}
          >
            {sheet.tables.length}
          </Badge>
        </button>
      ))}
    </nav>
  );
}
