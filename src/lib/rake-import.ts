import * as XLSX from "xlsx";
import type { Rake } from "./api";

export type RakeInput = {
  rake_name: string;
  rake_id: string | null;
  rake_basing: string | null;
  bpc_due_date: string | null;
};

function key(s: unknown) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toDate(v: unknown): string | null {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }
  return null;
}

export function parseRakeGrid(grid: unknown[][]): RakeInput[] {
  let header = -1;
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    if ((grid[r] ?? []).some((v) => key(v) === "rakename" || key(v) === "rake")) {
      header = r;
      break;
    }
  }
  if (header < 0) throw new Error("No “Rake Name” column was found in this file.");
  const h = (grid[header] ?? []).map(key);
  const col = (...names: string[]) => h.findIndex((k) => names.includes(k));
  const cName = col("rakename", "rake");
  const cId = col("rakeid", "id");
  const cBase = col("basing", "rakebasing", "base");
  const cBpc = col("bpcduedate", "bpcdue", "bpc", "bpcdate");
  const out: RakeInput[] = [];
  for (let r = header + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const name = String(row[cName] ?? "").trim();
    if (!name) continue;
    const s = (c: number) => (c >= 0 ? String(row[c] ?? "").trim() || null : null);
    out.push({
      rake_name: name,
      rake_id: s(cId),
      rake_basing: s(cBase),
      bpc_due_date: cBpc >= 0 ? toDate(row[cBpc]) : null,
    });
  }
  return out;
}

export async function parseRakeFile(file: File): Promise<RakeInput[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("The file has no sheets.");
  return parseRakeGrid(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" }));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Works out which rakes to update and which to add.
 * Same Rake ID -> update that rake. Same name but different Rake ID -> every rake sharing
 * that name is numbered "(1)", "(2)", … in the order: existing rakes first, then the file.
 */
export function planRakeImport(existing: Rake[], incoming: RakeInput[]) {
  const updates = new Map<string, Partial<Rake>>();
  const inserts: RakeInput[] = [];
  const byId = new Map(existing.filter((r) => r.rake_id).map((r) => [r.rake_id!, r]));

  type Entry = { ref: { kind: "existing"; rake: Rake } | { kind: "new"; row: RakeInput }; name: string; id: string | null };
  const entries: Entry[] = existing.map((r) => ({ ref: { kind: "existing", rake: r }, name: r.rake_name, id: r.rake_id }));

  for (const row of incoming) {
    const match = row.rake_id ? byId.get(row.rake_id) : existing.find((r) => !r.rake_id && r.rake_name === row.rake_name);
    if (match) {
      updates.set(match.id, {
        ...updates.get(match.id),
        rake_basing: row.rake_basing ?? match.rake_basing,
        bpc_due_date: row.bpc_due_date ?? match.bpc_due_date,
        ...(row.rake_id ? { rake_id: row.rake_id } : {}),
      });
      continue;
    }
    // duplicate row inside the file with the same id
    if (row.rake_id && entries.some((e) => e.ref.kind === "new" && e.id === row.rake_id)) continue;
    const created = { ...row };
    inserts.push(created);
    entries.push({ ref: { kind: "new", row: created }, name: row.rake_name, id: row.rake_id });
  }

  // names already numbered earlier, e.g. "CWC01 (1)", "CWC01 (2)": continue the numbering
  for (const e of entries) {
    if (e.ref.kind !== "new") continue;
    const re = new RegExp(`^${escape(e.name)} \\((\\d+)\\)$`);
    const nums = entries.map((x) => x.name.match(re)?.[1]).filter(Boolean).map(Number);
    if (nums.length) {
      e.name = `${e.ref.row.rake_name} (${Math.max(...nums) + 1})`;
      e.ref.row.rake_name = e.name;
    }
  }

  const groups = new Map<string, Entry[]>();
  for (const e of entries) groups.set(e.name, [...(groups.get(e.name) ?? []), e]);
  for (const [name, group] of groups) {
    const ids = new Set(group.map((e) => e.id ?? ""));
    if (group.length < 2 || ids.size < 2) continue;
    group.forEach((e, i) => {
      const numbered = `${name} (${i + 1})`;
      if (e.ref.kind === "new") e.ref.row.rake_name = numbered;
      else updates.set(e.ref.rake.id, { ...updates.get(e.ref.rake.id), rake_name: numbered });
    });
  }
  return { updates: [...updates.entries()].map(([id, patch]) => ({ id, patch })), inserts };
}
