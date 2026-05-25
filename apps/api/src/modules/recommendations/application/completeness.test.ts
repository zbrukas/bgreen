import { describe, expect, it } from "vitest";
import { classifyCompleteness } from "./completeness";

describe("classifyCompleteness", () => {
  it("IES + dimensao + records → FULL", () => {
    expect(
      classifyCompleteness({ hasIes: true, hasDimensao: true, hasRecords: true }),
    ).toBe("FULL");
  });

  it("IES + dimensao but no records → PARTIAL", () => {
    expect(
      classifyCompleteness({ hasIes: true, hasDimensao: true, hasRecords: false }),
    ).toBe("PARTIAL");
  });

  it("records but no IES → PARTIAL", () => {
    expect(
      classifyCompleteness({ hasIes: false, hasDimensao: false, hasRecords: true }),
    ).toBe("PARTIAL");
  });

  it("IES without dimensao → still PARTIAL", () => {
    expect(
      classifyCompleteness({ hasIes: true, hasDimensao: false, hasRecords: false }),
    ).toBe("PARTIAL");
  });

  it("dimensao without IES → still PARTIAL", () => {
    expect(
      classifyCompleteness({ hasIes: false, hasDimensao: true, hasRecords: false }),
    ).toBe("PARTIAL");
  });

  it("no IES + no dimensao + no records → INCOMPLETE (caller anchors on self-reported size)", () => {
    expect(
      classifyCompleteness({ hasIes: false, hasDimensao: false, hasRecords: false }),
    ).toBe("INCOMPLETE");
  });
});
