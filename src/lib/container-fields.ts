export const MODES = ["Road", "Rail", "Other"];
export const RAIL_OWNERSHIP = ["Own", "Other"];
export const OWNERSHIPS = ["Owned", "Hired"];
export const STATUSES = ["Empty", "Loaded"];
export const CONDITIONS = ["Okay", "Damaged", "Expired"];
export const CATEGORIES = ["Domestic", "EXIM"];
export const DRY_SUBTYPES = ["GP", "HC"];

export type EntryDraft = {
  container_no: string;
  mode: string;
  rail_ownership: string;
  rake_name: string;
  size: string;
  ctr_type: string;
  dry_subtype: string;
  ownership: string;
  status: string;
  weight: string;
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
  out_date: string;
  out_time: string;
};

export function emptyDraft(): EntryDraft {
  const now = new Date();
  return {
    container_no: "",
    mode: "Road",
    rail_ownership: "",
    rake_name: "",
    size: "20ft",
    ctr_type: "Dry",
    dry_subtype: "GP",
    ownership: "Owned",
    status: "Empty",
    weight: "",
    condition: "Okay",
    in_date: now.toISOString().slice(0, 10),
    in_time: now.toTimeString().slice(0, 5),
    cargo: "",
    category: "Domestic",
    account: "",
    yard_position: "",
    out_mode: "Road",
    out_rail_ownership: "",
    out_rake_name: "",
    out_date: now.toISOString().slice(0, 10),
    out_time: now.toTimeString().slice(0, 5),
  };
}

export function draftToRow(d: Partial<EntryDraft>, centreId: string) {
  const loaded = d.status === "Loaded";
  return {
    centre_id: centreId,
    container_no: (d.container_no ?? "").toUpperCase(),
    mode: d.mode || null,
    rail_ownership: d.mode === "Rail" ? d.rail_ownership || null : null,
    rake_name: d.mode === "Rail" ? d.rake_name || null : null,
    size: d.size || null,
    ctr_type: d.ctr_type || null,
    dry_subtype: d.ctr_type === "Dry" ? d.dry_subtype || null : null,
    ownership: d.ownership || null,
    status: d.status || null,
    weight: loaded && d.weight ? Number(d.weight) : null,
    condition: d.condition || null,
    in_date: d.in_date || null,
    in_time: d.in_time || null,
    cargo: loaded ? d.cargo || null : null,
    category: d.category || null,
    account: d.account || null,
    yard_position: d.yard_position || null,
  };
}
