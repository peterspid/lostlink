import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/items/abc?from=x")).toBe("/items/abc?from=x");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back for missing or relative values", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("items")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext(String.raw`/\evil.example`)).toBe("/");
    expect(safeNext("/\tfoo")).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeNext("//x", "/profile")).toBe("/profile");
  });
});
