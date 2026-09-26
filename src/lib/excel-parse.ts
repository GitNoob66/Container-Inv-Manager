import * as XLSX from "xlsx";
import { CONTAINER_NO_REGEX, normalizeContainerNo, validateContainerNo } from "./iso6346";

export type ParsedRow = {
  containerNo: string;
  size?: string;
  ctrType?: string;
  drySubtype?: string;
  status?: string;
  weight?: string;
  cargo?: string;
  account?: string;
  category?: string;
  condition?: string;
  yardPosition?: string;
  ownership?: string;
  isoCode?: string;
};

export type ParseResult = {
  rows: ParsedRow[];
  warnings: string[];
  detectedFields: string[];
  sheetName: string;
};

/** Column-name synonyms used across terminal / rail / depot reports. */
const SYNONYMS: Record<keyof Omit<ParsedRow, "containerNo">, string[]> = {
  size: ["size", "ctrsize", "containersize", "ctsize", "cntrsize", "sz", "length", "contsize"],
  ctrType: ["type", "ctrtype", "containertype", "conttype", "equipmenttype", "eqtype", "cttype"],
  drySubtype: ["subtype", "height", "gpHc", "gphc"],
  status: [
    "status",
    "ctrsts",
    "containerstatus",
    "le",
    "ldempty",
    "emptyloaded",
    "loadedempty",
    "fullempty",
    "loadstatus",
    "contstatus",
    "ef",
    "lorE",
  ],
  weight: [
    "weight",
    "grossweight",
    "grosswt",
    "grwt",
    "gwt",
    "netweight",
    "netwt",
    "cargowt",
    "cargoweight",
    "vgm",
    "grossweightvgm",
    "wt",
    "tonnage",
    "payload",
  ],
  cargo: [
    "cargo",
    "commodity",
    "contcommodity",
    "cargodescription",
    "goods",
    "description",
    "commoditydesc",
  ],
  account: [
    "account",
    "party",
    "line",
    "sline",
    "shippingline",
    "boxoperator",
    "operator",
    "lineagent",
    "agent",
    "customer",
    "client",
    "consignee",
    "importer",
    "nameofimporter",
    "principal",
    "owner",
  ],
  category: ["category", "ctrcategory", "tradetype", "trade", "exim", "type1", "movementtype"],
  condition: ["condition", "damagecondition", "damageconditionremarks", "remarks", "ctrcondition"],
  yardPosition: [
    "yardposition",
    "position",
    "location",
    "slot",
    "yard",
    "block",
    "yardlocation",
    "stackposition",
  ],
  ownership: ["ownership", "owned", "ownhired", "ownedhired", "equipmentownership"],
  isoCode: ["isocode", "iso", "isotype", "isosizetype", "sizetypecode"],
};

const CONTAINER_HEADERS = [
  "containerno",
  "container",
  "containernumber",
  "ctrnumber",
  "ctrno",
  "contno",
  "contnumber",
  "cntrno",
  "cntrnumber",
  "unitno",
  "unitnumber",
  "equipmentno",
  "equipmentnumber",
  "boxno",
  "boxnumber",
  "containerid",
];

function key(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function matchField(header: string): keyof ParsedRow | null {
  const k = key(header);
  if (!k) return null;
  if (CONTAINER_HEADERS.includes(k)) return "containerNo";
  if (k.includes("container") && (k.includes("no") || k.includes("num"))) return "containerNo";
  for (const [field, list] of Object.entries(SYNONYMS)) {
    if (list.map(key).includes(k)) return field as keyof ParsedRow;
  }
  // loose contains-match, longest synonym first
  for (const [field, list] of Object.entries(SYNONYMS)) {
    for (const syn of list) {
      const sk = key(syn);
      if (sk.length >= 4 && k.includes(sk)) return field as keyof ParsedRow;
    }
  }
  return null;
}

function normSize(raw: string): string | undefined {
  const s = raw.toUpperCase();
  if (/45/.test(s)) return "45ft";
  if (/40/.test(s)) return "40ft";
  if (/20/.test(s)) return "20ft";
  return undefined;
}

function normStatus(raw: string): string | undefined {
  const s = raw.trim().toUpperCase();
  if (!s) return undefined;
  if (["E", "MT", "EMPTY", "EMT"].includes(s)) return "Empty";
  if (["L", "F", "FULL", "LOADED", "LADEN"].includes(s)) return "Loaded";
  if (s.includes("EMPT")) return "Empty";
  if (s.includes("LOAD") || s.includes("FULL")) return "Loaded";
  return undefined;
}

function normCategory(raw: string): string | undefined {
  const s = raw.toUpperCase();
  if (!s) return undefined;
  if (s.includes("EXIM") || s.includes("FOREIGN") || s.includes("EXP") || s.includes("IMP"))
    return "EXIM";
  if (s.includes("DOM") || s.includes("LOCAL")) return "Domestic";
  return undefined;
}

function normType(raw: string): { ctrType?: string; drySubtype?: string } {
  const s = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return {};
  if (s.includes("REEF") || s === "RF" || s === "RE") return { ctrType: "Reefer" };
  if (s.includes("OPENTOP") || s === "OT") return { ctrType: "Open Top" };
  if (s.includes("FLAT") || s === "FR") return { ctrType: "Flat Rack" };
  if (s.includes("TANK") || s === "TK") return { ctrType: "Tank" };
  if (s.includes("SIDE")) return { ctrType: "Side Access" };
  if (s === "HC" || s.includes("HIGHCUBE")) return { ctrType: "Dry", drySubtype: "HC" };
  if (s === "GP" || s.includes("GENERAL")) return { ctrType: "Dry", drySubtype: "GP" };
  if (s.includes("DRY")) return { ctrType: "Dry" };
  return {};
}

/** ISO 6346 size/type code, e.g. 4510 / 45G1 / 22G1 / 22R1. */
function fromIsoCode(code: string): Partial<ParsedRow> {
  const c = code.trim().toUpperCase();
  if (c.length < 4) return {};
  const out: Partial<ParsedRow> = {};
  const sizeChar = c[0];
  if (sizeChar === "2") out.size = "20ft";
  else if (sizeChar === "4") out.size = "40ft";
  else if (sizeChar === "L" || sizeChar === "9") out.size = "45ft";
  const heightChar = c[1];
  const group = c[2];
  if (group === "G") out.ctrType = "Dry";
  else if (group === "R" || group === "H") out.ctrType = "Reefer";
  else if (group === "U") out.ctrType = "Open Top";
  else if (group === "P") out.ctrType = "Flat Rack";
  else if (group === "T") out.ctrType = "Tank";
  else if (group === "1" || group === "0" || group === "5") out.ctrType = "Dry";
  if (out.ctrType === "Dry") {
    out.drySubtype = ["2", "3", "4", "5", "6"].includes(heightChar) ? "HC" : "GP";
  }
  return out;
}

function looksLikeContainer(v: string): boolean {
  return CONTAINER_NO_REGEX.test(normalizeContainerNo(v));
}

export async function parseContainerFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });

  let best: ParseResult | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    const result = parseGrid(grid, sheetName);
    if (!best || result.rows.length > best.rows.length) best = result;
  }

  if (!best) {
    return { rows: [], warnings: ["The file contains no readable sheets."], detectedFields: [], sheetName: "" };
  }
  return best;
}

function parseGrid(grid: unknown[][], sheetName: string): ParseResult {
  const warnings: string[] = [];

  // 1. Find the first row that contains a container-shaped value.
  let firstDataRow = -1;
  let containerCol = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (looksLikeContainer(cell(row[c]))) {
        firstDataRow = r;
        containerCol = c;
        break;
      }
    }
    if (firstDataRow >= 0) break;
  }

  // 2. Find a header row: nearest row above the data with recognisable labels.
  let headerRow = -1;
  const searchEnd = firstDataRow >= 0 ? firstDataRow : Math.min(grid.length, 25);
  for (let r = searchEnd - 1; r >= 0 && r >= searchEnd - 12; r--) {
    const row = grid[r] || [];
    const hits = row.filter((v) => matchField(cell(v)) !== null).length;
    if (hits >= 2) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    // maybe headers exist but no data yet
    for (let r = 0; r < Math.min(grid.length, 25); r++) {
      const row = grid[r] || [];
      const hits = row.filter((v) => matchField(cell(v)) !== null).length;
      if (hits >= 2) {
        headerRow = r;
        break;
      }
    }
  }

  const colMap = new Map<number, keyof ParsedRow>();
  if (headerRow >= 0) {
    const row = grid[headerRow] || [];
    for (let c = 0; c < row.length; c++) {
      const f = matchField(cell(row[c]));
      if (f && ![...colMap.values()].includes(f)) colMap.set(c, f);
    }
  }
  if (containerCol >= 0 && ![...colMap.values()].includes("containerNo")) {
    colMap.set(containerCol, "containerNo");
  }

  const startRow = headerRow >= 0 ? headerRow + 1 : firstDataRow >= 0 ? firstDataRow : 0;
  const rows: ParsedRow[] = [];
  const seen = new Set<string>();

  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r] || [];

    // locate the container number for this row, tolerating shifted columns
    let cn = "";
    for (const [c, f] of colMap) {
      if (f === "containerNo") cn = normalizeContainerNo(cell(row[c]));
    }
    if (!looksLikeContainer(cn)) {
      cn = "";
      for (let c = 0; c < row.length; c++) {
        const v = normalizeContainerNo(cell(row[c]));
        if (looksLikeContainer(v)) {
          cn = v;
          break;
        }
      }
    }
    if (!cn) continue;
    if (seen.has(cn)) continue;
    seen.add(cn);

    const raw: Record<string, string> = {};
    for (const [c, f] of colMap) {
      if (f === "containerNo") continue;
      const v = cell(row[c]);
      if (v) raw[f] = v;
    }

    const parsed: ParsedRow = { containerNo: cn };
    if (raw.isoCode) Object.assign(parsed, fromIsoCode(raw.isoCode));
    if (raw.size) parsed.size = normSize(raw.size) ?? parsed.size;
    if (raw.ctrType) {
      const t = normType(raw.ctrType);
      if (t.ctrType) parsed.ctrType = t.ctrType;
      if (t.drySubtype) parsed.drySubtype = t.drySubtype;
      // some sheets put the size in a column labelled "Type"
      if (!parsed.size) parsed.size = normSize(raw.ctrType) ?? parsed.size;
      if (!t.ctrType && normCategory(raw.ctrType)) parsed.category = normCategory(raw.ctrType);
    }
    if (raw.drySubtype) {
      const t = normType(raw.drySubtype);
      if (t.drySubtype) parsed.drySubtype = t.drySubtype;
    }
    if (raw.status) parsed.status = normStatus(raw.status);
    if (raw.category) parsed.category = normCategory(raw.category) ?? parsed.category;
    if (raw.weight) {
      const n = Number(String(raw.weight).replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(n) && n > 0) parsed.weight = String(n);
    }
    if (raw.cargo) parsed.cargo = raw.cargo;
    if (raw.account) parsed.account = raw.account;
    if (raw.yardPosition) parsed.yardPosition = raw.yardPosition;
    if (raw.condition) {
      const c = raw.condition.toUpperCase();
      if (c.includes("DAMAG")) parsed.condition = "Damaged";
      else if (c.includes("EXPIR")) parsed.condition = "Expired";
    }
    if (raw.ownership) {
      const o = raw.ownership.toUpperCase();
      if (o.includes("HIRE") || o.includes("LEAS")) parsed.ownership = "Hired";
      else if (o.includes("OWN")) parsed.ownership = "Owned";
    }
    if (parsed.weight && !parsed.status) parsed.status = "Loaded";
    rows.push(parsed);
  }

  const detected = [...new Set([...colMap.values()].filter((f) => f !== "containerNo"))] as string[];

  if (headerRow < 0 && rows.length > 0) {
    warnings.push(
      "No column headers were recognised — only container numbers were read. Fill the other details below.",
    );
  } else if (detected.length === 0 && rows.length > 0) {
    warnings.push("Only container numbers could be read from this file.");
  }
  if (rows.length === 0) {
    warnings.push("No valid container numbers were found in this file.");
  }

  const invalid = rows.filter((r) => !validateContainerNo(r.containerNo).valid);
  if (invalid.length) {
    warnings.push(
      `${invalid.length} container number(s) failed the ISO 6346 check: ${invalid
        .slice(0, 8)
        .map((r) => r.containerNo)
        .join(", ")}${invalid.length > 8 ? "…" : ""}`,
    );
  }

  return { rows, warnings, detectedFields: detected, sheetName };
}
