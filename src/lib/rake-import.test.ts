import { describe, expect, it } from "vitest";
import type { Rake } from "./api";
import { planRakeImport } from "./rake-import";

const rake = (p: Partial<Rake>): Rake => ({
  id: "x", rake_name: "", rake_id: null, rake_basing: null, bpc_due_date: null,
  ownership: "Owned", wagons: null, current_user_type: "Self", rake_type: null, ...p,
});

describe("rake upload", () => {
  it("numbers two rakes with the same name and different IDs", () => {
    const plan = planRakeImport([], [
      { rake_name: "CWC01", rake_id: "A1", rake_basing: null, bpc_due_date: null },
      { rake_name: "CWC01", rake_id: "B2", rake_basing: null, bpc_due_date: null },
    ]);
    expect(plan.inserts.map((r) => r.rake_name)).toEqual(["CWC01 (1)", "CWC01 (2)"]);
  });
  it("updates a rake with the same ID instead of adding it", () => {
    const plan = planRakeImport([rake({ id: "r1", rake_name: "CWC01", rake_id: "A1" })], [
      { rake_name: "CWC01", rake_id: "A1", rake_basing: "Nimpura", bpc_due_date: "2026-11-16" },
    ]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates[0]?.patch.bpc_due_date).toBe("2026-11-16");
  });
  it("renames an existing rake when a new one shares its name", () => {
    const plan = planRakeImport([rake({ id: "r1", rake_name: "CWC02", rake_id: "A1" })], [
      { rake_name: "CWC02", rake_id: "Z9", rake_basing: null, bpc_due_date: null },
    ]);
    expect(plan.updates.find((u) => u.id === "r1")?.patch.rake_name).toBe("CWC02 (1)");
    expect(plan.inserts[0]?.rake_name).toBe("CWC02 (2)");
  });
});
