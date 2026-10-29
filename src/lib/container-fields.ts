import type { Container } from "./api";
import { validateContainerNo } from "./iso6346";

export const MODES = ["Road", "Rail", "Other"];
export const RAIL_OWNERSHIP = ["Own", "Other"];
export const OWNERSHIPS = ["Owned", "Hired"];
export const STATUSES = ["Empty", "Loaded"];
export const CONDITIONS = ["Okay", "Damaged", "Expired"];
export const CATEGORIES = ["Domestic", "EXIM"];
export const DRY_SUBTYPES = ["GP", "HC"];
export const STACKS = ["Lower", "Upper"];

/** Grid / draft keys for custom columns are prefixed so they never clash with built-in fields. */
export const CUSTOM_PREFIX = "cf_";

export type EntryDraft = {
  container_no: string;
  mode: string;
  rail_ownership: string;
  rake_name: string;
  wagon_no: string;
  stack: string;
  double_stack: string;
  truck_no: string;
  size: string;
  ctr_type: string;
  dry_subtype: string;
  ownership: string;
  lessor: string;
  status: string;
  weight: string;
  net_weight: string;
  seal_no: string;
  inward_bill_no: string;
  condition: string;
  in_date: string;
  in_time: string;
  cargo: string;
  category: string;
  account: string;
  yard_position: string;
  out_mode: string;
  out_rail_ownership: string;
  out_rake_name: string;
  out_wagon_no: string;
  out_stack: string;
  out_truck_no: string;
  out_date: string;
  out_time: string;
  destination: string;
  remarks: string;
  [custom: `cf_${string}`]: string;
};

function localDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function emptyDraft(): EntryDraft {
  const now = new Date();
  return {
    container_no: "",
    mode: "Road",
    rail_ownership: "",
    rake_name: "",
    wagon_no: "",
    stack: "Lower",
    double_stack: "",
    truck_no: "",
    size: "20ft",
    ctr_type: "Dry",
    dry_subtype: "GP",
    ownership: "Owned",
    lessor: "",
    status: "Empty",
    weight: "",
    net_weight: "",
    seal_no: "",
    inward_bill_no: "",
    condition: "Okay",
    in_date: localDate(now),
    in_time: now.toTimeString().slice(0, 5),
    cargo: "",
    category: "Domestic",
    account: "",
    yard_position: "",
    out_mode: "Road",
    out_rail_ownership: "",
    out_rake_name: "",
    out_wagon_no: "",
    out_stack: "Lower",
    out_truck_no: "",
    out_date: localDate(now),
    out_time: now.toTimeString().slice(0, 5),
    destination: "",
    remarks: "",
  };
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
}

export function customFromRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith(CUSTOM_PREFIX) && v) out[k.slice(CUSTOM_PREFIX.length)] = v;
  }
  return out;
}

export function customToRow(custom: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(custom ?? {})) out[`${CUSTOM_PREFIX}${k}`] = String(v ?? "");
  return out;
}

/** Inward / inventory fields as stored. Invalid ISO numbers are kept but flagged. */
export function draftToRow(d: Partial<EntryDraft> & Record<string, string>, centreId: string) {
  const loaded = d.status === "Loaded";
  const rail = d.mode === "Rail";
  const containerNo = (d.container_no ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return {
    centre_id: centreId,
    container_no: containerNo,
    iso_valid: validateContainerNo(containerNo).valid,
    mode: d.mode || null,
    rail_ownership: rail ? d.rail_ownership || null : null,
    rake_name: rail ? d.rake_name || null : null,
    wagon_no: rail ? d.wagon_no || null : null,
    stack: rail && d.wagon_no ? d.stack || "Lower" : null,
    double_stack: rail && d.double_stack === "true",
    truck_no: d.mode === "Road" ? (d.truck_no || "").toUpperCase() || null : null,
    size: d.size || null,
    ctr_type: d.ctr_type || null,
    dry_subtype: d.ctr_type === "Dry" ? d.dry_subtype || null : null,
    ownership: d.ownership || null,
    lessor: d.ownership === "Hired" ? d.lessor || null : null,
    status: d.status || null,
    weight: loaded ? num(d.weight) : null,
    net_weight: num(d.net_weight),
    seal_no: d.seal_no || null,
    inward_bill_no: d.inward_bill_no || null,
    condition: d.condition || null,
    in_date: d.in_date || null,
    in_time: d.in_time || null,
    cargo: loaded ? d.cargo || null : null,
    category: d.category || null,
    account: d.account || null,
    yard_position: d.yard_position || null,
    custom_fields: customFromRow(d),
  } satisfies Partial<Container>;
}

/** Outward fields as stored when a container moves out. */
export function outwardPatch(r: Record<string, string>, base: Record<string, string> = {}) {
  const rail = r.out_mode === "Rail";
  return {
    out_mode: r.out_mode || null,
    out_rail_ownership: rail ? r.out_rail_ownership || null : null,
    out_rake_name: rail ? r.out_rake_name || null : null,
    out_wagon_no: rail ? r.out_wagon_no || null : null,
    out_stack: rail && r.out_wagon_no ? r.out_stack || "Lower" : null,
    out_double_stack: rail && r.out_double_stack === "true",
    out_truck_no: r.out_mode === "Road" ? (r.out_truck_no || "").toUpperCase() || null : null,
    out_date: r.out_date || null,
    out_time: r.out_time || null,
    destination: r.destination || null,
    remarks: r.remarks || null,
    cargo: r.cargo || null,
    yard_position: r.yard_position || null,
    custom_fields: { ...customFromRow(base), ...customFromRow(r) },
    dispatched: true,
  } satisfies Partial<Container>;
}

/** Container record -> editable grid row (all strings). */
export function containerToRow(c: Container): Record<string, string> {
  return {
    container_no: c.container_no,
    mode: c.mode ?? "",
    rail_ownership: c.rail_ownership ?? "",
    rake_name: c.rake_name ?? "",
    wagon_no: c.wagon_no ?? "",
    stack: c.stack ?? "",
    double_stack: c.double_stack ? "true" : "",
    truck_no: c.truck_no ?? "",
    size: c.size ?? "",
    ctr_type: c.ctr_type ?? "",
    dry_subtype: c.dry_subtype ?? "",
    ownership: c.ownership ?? "",
    lessor: c.lessor ?? "",
    status: c.status ?? "",
    weight: c.weight != null ? String(c.weight) : "",
    net_weight: c.net_weight != null ? String(c.net_weight) : "",
    seal_no: c.seal_no ?? "",
    inward_bill_no: c.inward_bill_no ?? "",
    condition: c.condition ?? "",
    in_date: c.in_date ?? "",
    in_time: c.in_time ?? "",
    cargo: c.cargo ?? "",
    category: c.category ?? "",
    account: c.account ?? "",
    yard_position: c.yard_position ?? "",
    ...customToRow(c.custom_fields),
  };
}
