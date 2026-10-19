import { describe, expect, it } from "vitest";
import { checkWagonLoad, parseWagonGrid, wagonFull } from "./wagons";

const W = "38262513495";

describe("single stack wagon", () => {
  it("takes two 20ft containers", () => {
    expect(checkWagonLoad([{ wagon_no: W, size: "20ft", stack: "Lower" }], W, "20ft", "Lower", false)).toBeNull();
  });
  it("rejects a third 20ft container", () => {
    const loads = [
      { wagon_no: W, size: "20ft", stack: "Lower" },
      { wagon_no: W, size: "20ft", stack: "Lower" },
    ];
    expect(checkWagonLoad(loads, W, "20ft", "Lower", false)).not.toBeNull();
  });
  it("rejects a 20ft next to a 40ft", () => {
    expect(checkWagonLoad([{ wagon_no: W, size: "40ft", stack: "Lower" }], W, "20ft", "Lower", false)).not.toBeNull();
  });
  it("rejects the upper stack", () => {
    expect(checkWagonLoad([], W, "40ft", "Upper", false)).not.toBeNull();
  });
  it("is full after one 40ft", () => {
    expect(wagonFull([{ wagon_no: W, size: "40ft", stack: "Lower" }], W, false)).toBe(true);
  });
});

describe("double stack wagon", () => {
  it("takes 2 x 20ft lower and 1 x 40ft upper", () => {
    const loads = [
      { wagon_no: W, size: "20ft", stack: "Lower" },
      { wagon_no: W, size: "20ft", stack: "Lower" },
    ];
    expect(checkWagonLoad(loads, W, "40ft", "Upper", true)).toBeNull();
  });
  it("takes 2 x 40ft", () => {
    expect(checkWagonLoad([{ wagon_no: W, size: "40ft", stack: "Lower" }], W, "40ft", "Upper", true)).toBeNull();
  });
  it("never puts a 20ft on the upper stack", () => {
    expect(checkWagonLoad([], W, "20ft", "Upper", true)).not.toBeNull();
  });
  it("rejects a second upper container", () => {
    expect(checkWagonLoad([{ wagon_no: W, size: "40ft", stack: "Upper" }], W, "45ft", "Upper", true)).not.toBeNull();
  });
  it("is full after 40ft lower and 40ft upper", () => {
    const loads = [
      { wagon_no: W, size: "40ft", stack: "Lower" },
      { wagon_no: W, size: "40ft", stack: "Upper" },
    ];
    expect(wagonFull(loads, W, true)).toBe(true);
  });
});

describe("wagon file", () => {
  it("reads wagon numbers sorted ascending", () => {
    const rows = parseWagonGrid([
      ["S.NO.", "WAGON NUMBER", "TYPE"],
      [1, 38262513495, "BLSSB"],
      [2, 37262610173, "BLSSA"],
    ]);
    expect(rows.map((r) => r.wagon_no)).toEqual(["37262610173", "38262513495"]);
    expect(rows[0]?.wagon_type).toBe("BLSSA");
  });
});
