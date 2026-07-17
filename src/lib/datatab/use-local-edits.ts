"use client";

import { useCallback, useEffect, useState } from "react";
import { logActivity } from "@/lib/activity/log";
import { calcColumnId, type CalcFormat } from "@/lib/formula/calc-columns";
import type { ParsedColumn } from "@/lib/schemas/workbook";
import { blankRow, editedCell, editKey, emptyEdits, withNote, type LocalEdits } from "./derive";

const storeKey = (name: string) => `ampulse:datatab:${name}`;

const load = (name: string): LocalEdits => {
  if (typeof window === "undefined") return emptyEdits();
  try {
    const raw = localStorage.getItem(storeKey(name));
    return raw ? (JSON.parse(raw) as LocalEdits) : emptyEdits();
  } catch {
    return emptyEdits();
  }
};

/**
 * All local (non-Databricks) edits for one dataset's data tab: calc columns,
 * cell overrides and appended rows. Persisted per dataset in localStorage and
 * mirrored into the activity feed.
 */
export function useLocalEdits(name: string, label: string) {
  const href = `/datasets/${name}`;
  // Keyed by dataset name at the CompanyView level, so this remounts (and
  // re-reads storage) when the user navigates to a different dataset.
  const [state, setState] = useState<LocalEdits>(() => load(name));

  // Persist edits. Writing the just-loaded state back on mount is a harmless no-op.
  useEffect(() => {
    try {
      localStorage.setItem(storeKey(name), JSON.stringify(state));
    } catch {
      /* quota / private mode — edits stay in memory */
    }
  }, [name, state]);

  const log = useCallback(
    (kind: Parameters<typeof logActivity>[0]["kind"], message: string) =>
      logActivity({ dataset: name, label, href, kind, message }),
    [name, label, href]
  );

  const addColumn = useCallback(
    (spec: { name: string; formula: string; format: CalcFormat }) => {
      const id = crypto.randomUUID();
      setState((s) => ({ ...s, calcSpecs: [...s.calcSpecs, { id, ...spec }] }));
      log("add-column", `Added column “${spec.name}” = ${spec.formula}`);
    },
    [log]
  );

  const deleteColumn = useCallback(
    (columnId: string) => {
      const spec = state.calcSpecs.find((sp) => calcColumnId(sp.id) === columnId);
      setState((s) => ({ ...s, calcSpecs: s.calcSpecs.filter((sp) => calcColumnId(sp.id) !== columnId) }));
      if (spec) log("delete-column", `Removed column “${spec.name}”`);
    },
    [log, state.calcSpecs]
  );

  const editCell = useCallback(
    (rowIndex: number, column: ParsedColumn, text: string) => {
      setState((s) => ({
        ...s,
        edits: { ...s.edits, [editKey(rowIndex, column.id)]: editedCell(text, column.typeOverride ?? column.inferredType) },
      }));
      log("edit-cell", `Edited ${column.name}, row ${rowIndex + 1} → ${text.trim() || "(blank)"}`);
    },
    [log]
  );

  const addRow = useCallback(
    (columns: ParsedColumn[], baseRowCount: number) => {
      setState((s) => ({ ...s, addedRows: [...s.addedRows, blankRow(columns)] }));
      log("add-row", `Added row ${baseRowCount + 1}`);
    },
    [log]
  );

  const deleteRow = useCallback(
    (rowIndex: number, displayNumber: number) => {
      setState((s) =>
        s.deletedRows.includes(rowIndex) ? s : { ...s, deletedRows: [...s.deletedRows, rowIndex] }
      );
      log("delete-row", `Deleted row ${displayNumber}`);
    },
    [log]
  );

  const setNote = useCallback(
    (rowIndex: number, column: ParsedColumn, text: string) => {
      setState((s) => withNote(s, rowIndex, column.id, text));
      log("edit-cell", text.trim() ? `Noted ${column.name}, row ${rowIndex + 1}` : `Cleared note on ${column.name}, row ${rowIndex + 1}`);
    },
    [log]
  );

  return { state, addColumn, deleteColumn, editCell, addRow, deleteRow, setNote };
}

export type LocalEditsApi = ReturnType<typeof useLocalEdits>;
