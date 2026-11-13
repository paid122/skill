import { describe, expect, it } from "vitest";
import { chooseModel } from "../src/lib/matrixxConnect";

describe("chooseModel", () => {
  const data = [{ id: "a/first:free", free: true }, { id: "nvidia/nemotron:free", free: true, recommended: true }, { id: "paid/x", free: false }];
  it("uses the plan's recommended smart model", () => {
    expect(chooseModel({ data, recommended: { smart: ["gone/model", "nvidia/nemotron:free"], fast: [] } })).toBe("nvidia/nemotron:free");
  });
  it("falls back to a flagged, then a free, then the first model", () => {
    expect(chooseModel({ data })).toBe("nvidia/nemotron:free");
    expect(chooseModel({ data: [{ id: "paid/x", free: false }, { id: "b:free", free: true }] })).toBe("b:free");
    expect(chooseModel({ data: [{ id: "paid/x" }] })).toBe("paid/x");
    expect(chooseModel({ data: [] })).toBeNull();
    expect(chooseModel(null)).toBeNull();
  });
});
