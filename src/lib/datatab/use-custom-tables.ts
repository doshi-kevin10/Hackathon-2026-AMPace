"use client";

import { useCallback, useEffect, useState } from "react";
import { logActivity } from "@/lib/activity/log";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";
import { emptyEdits, type LocalEdits } from "./derive";

/** A standalone, user-owned table inside a company: a frozen data snapshot + its own edit layer. */
export interface CustomTable {
  id: string;
  name: string;
  /** Palette color index; resolved to a CSS var for display. */
  colorIndex: number;
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
  local: LocalEdits;
}

const storeKey = (name: string) => `ampace:customtables:${name}`;

const load = (name: string): CustomTable[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storeKey(name));
    return raw ? (JSON.parse(raw) as CustomTable[]) : [];
  } catch {
    return [];
  }
};

/** All custom tables for one company, persisted to localStorage (never touches Databricks). */
export function useCustomTables(name: string, label: string) {
  const href = `/datasets/${name}`;
  const [tables, setTables] = useState<CustomTable[]>(() => load(name));

  useEffect(() => {
    try {
      localStorage.setItem(storeKey(name), JSON.stringify(tables));
    } catch {
      /* quota / private mode — tables stay in memory */
    }
  }, [name, tables]);

  const create = useCallback(
    (tableName: string, snapshot: { columns: ParsedColumn[]; rows: Record<string, CellValue>[] }): string => {
      const id = crypto.randomUUID();
      setTables((ts) => [
        ...ts,
        { id, name: tableName.trim() || "New table", colorIndex: ts.length + 3, columns: snapshot.columns, rows: snapshot.rows, local: emptyEdits() },
      ]);
      logActivity({ dataset: name, label, href, kind: "add-column", message: `Created table “${tableName.trim() || "New table"}” (${snapshot.rows.length} rows)` });
      return id;
    },
    [name, label, href]
  );

  const remove = useCallback(
    (id: string) => {
      const t = tables.find((x) => x.id === id);
      setTables((ts) => ts.filter((x) => x.id !== id));
      if (t) logActivity({ dataset: name, label, href, kind: "delete-column", message: `Deleted table “${t.name}”` });
    },
    [name, label, href, tables]
  );

  const rename = useCallback((id: string, tableName: string) => {
    const n = tableName.trim();
    if (n) setTables((ts) => ts.map((t) => (t.id === id ? { ...t, name: n } : t)));
  }, []);

  const recolor = useCallback((id: string, colorIndex: number) => {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, colorIndex } : t)));
  }, []);

  /** Apply a pure transform to one table's edit layer. */
  const update = useCallback((id: string, fn: (l: LocalEdits) => LocalEdits) => {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, local: fn(t.local) } : t)));
  }, []);

  return { tables, create, remove, rename, recolor, update };
}
