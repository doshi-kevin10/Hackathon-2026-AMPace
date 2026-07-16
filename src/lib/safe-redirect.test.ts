import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext (open-redirect guard)", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNext("/datasets/excel_x")).toBe("/datasets/excel_x");
    expect(safeNext("/?tab=1")).toBe("/?tab=1");
  });

  it("rejects open-redirect vectors, falling back to /", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "http://evil.com",
      "evil.com",
      "/foo\\bar",
      "/foo\nbar",
      "",
      null,
      undefined,
    ]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
