import * as XLSX from "xlsx";

export type Wagon = { wagon_no: string; wagon_type: string };
export type WagonLoad = { wagon_no: string; size: string; stack: string };

function key(s: unknown) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Reads wagon numbers (and types) from an xls/xlsx/csv sheet, sorted ascending. */
export async function parseWagonFile(file: File): Promise<Wagon[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
  return parseWagonGrid(
    wb.SheetNames.flatMap((n) => {
      const s = wb.Sheets[n];
      return s ? XLSX.utils.sheet_to_json<unknown[]>(s, { header: 1, blankrows: false, defval: "" }) : [];
    }),
  );
}

export function parseWagonGrid(grid: unknown[][]): Wagon[] {
  let noCol = -1;
  let typeCol = -1;
  let start = 0;
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const row = grid[r] ?? [];
    const n = row.findIndex((v) => {
      const k = key(v);
      return k.includes("wagon") && (k.includes("no") || k.includes("num")) || k === "wagon";
    });
    if (n >= 0) {
      noCol = n;
      typeCol = row.findIndex((v, i) => i !== n && key(v).includes("type"));
      start = r + 1;
      break;
    }
  }
  const out = new Map<string, Wagon>();
  for (let r = start; r < grid.length; r++) {
    const row = grid[r] ?? [];
    let no = noCol >= 0 ? String(row[noCol] ?? "").trim() : "";
    if (noCol < 0) {
      // no header: take the first long numeric value in the row
      const hit = row.map((v) => String(v ?? "").trim()).find((v) => /^\d{8,}$/.test(v));
      no = hit ?? "";
    }
    no = no.replace(/\s+/g, "").replace(/\.0+$/, "");
    if (!no || !/\d/.test(no)) continue;
    out.set(no, { wagon_no: no, wagon_type: typeCol >= 0 ? String(row[typeCol] ?? "").trim() : "" });
  }
  return [...out.values()].sort((a, b) => a.wagon_no.localeCompare(b.wagon_no, undefined, { numeric: true }));
}

const is20 = (size: string) => size.startsWith("20");

/**
 * Wagon loading rules.
 * Single stack: 2 x 20ft OR 1 x 40/45ft, all on the lower deck.
 * Double stack: lower deck 2 x 20ft or 1 x 40/45ft, upper deck 1 x 40/45ft. 20ft never on upper.
 * Returns an error message when the new container breaks the rules, otherwise null.
 */
export function checkWagonLoad(
  existing: WagonLoad[],
  wagonNo: string,
  size: string,
  stack: string,
  doubleStack: boolean,
): string | null {
  if (!wagonNo) return null;
  const onWagon = existing.filter((l) => l.wagon_no === wagonNo);
  const deck = doubleStack ? stack || "Lower" : "Lower";
  if (!doubleStack && stack === "Upper") return "Upper stack is only available on a double stack rake.";
  if (deck === "Upper" && is20(size)) return "A 20ft container can't be loaded on the upper stack.";
  if (deck === "Upper") {
    if (onWagon.some((l) => l.stack === "Upper")) return `Wagon ${wagonNo}: the upper stack already has a 40ft container.`;
    return null;
  }
  const lower = onWagon.filter((l) => l.stack !== "Upper");
  const units = lower.reduce((s, l) => s + (is20(l.size) ? 1 : 2), 0);
  const add = is20(size) ? 1 : 2;
  if (units + add > 2) {
    return doubleStack
      ? `Wagon ${wagonNo}: the lower stack is full (2 x 20ft or 1 x 40ft).`
      : `Wagon ${wagonNo} is full — a single stack wagon takes 2 x 20ft or 1 x 40ft.`;
  }
  return null;
}

/** True when no further container of any size fits on the wagon. */
export function wagonFull(existing: WagonLoad[], wagonNo: string, doubleStack: boolean): boolean {
  const lowerFull = checkWagonLoad(existing, wagonNo, "20ft", "Lower", doubleStack) !== null;
  if (!doubleStack) return lowerFull;
  const upperFull = checkWagonLoad(existing, wagonNo, "40ft", "Upper", true) !== null;
  return lowerFull && upperFull;
}

/** Wagons still open for loading, sorted ascending. `keep` stays listed (the row's current wagon). */
export function availableWagons(wagons: Wagon[], loads: WagonLoad[], doubleStack: boolean, keep?: string) {
  return wagons
    .map((w) => w.wagon_no)
    .filter((no) => no === keep || !wagonFull(loads, no, doubleStack));
}
