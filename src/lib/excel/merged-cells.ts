import type { CellMatrix, Region } from "./types";

/**
 * Propagate each merge's anchor cell into the cells it covers so that
 * region/header detection sees merged areas as populated. The anchor keeps
 * `merge.anchor = true`; covered copies get `anchor = false`.
 */
export function expandMerges(matrix: CellMatrix): void {
  for (const m of matrix.merges) {
    const anchor = matrix.cells[m.r0]?.[m.c0];
    for (let r = m.r0; r <= Math.min(m.r1, matrix.rows - 1); r++) {
      for (let c = m.c0; c <= Math.min(m.c1, matrix.cols - 1); c++) {
        const isAnchor = r === m.r0 && c === m.c0;
        if (isAnchor) {
          if (anchor) anchor.merge = { ...m, anchor: true };
        } else if (anchor) {
          matrix.cells[r][c] = { ...anchor, merge: { ...m, anchor: false } };
        }
      }
    }
  }
}

export const mergeIntersects = (m: Region, region: Region): boolean =>
  m.r0 <= region.r1 && m.r1 >= region.r0 && m.c0 <= region.c1 && m.c1 >= region.c0;
