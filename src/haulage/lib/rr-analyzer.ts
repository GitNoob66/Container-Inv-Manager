import { ratesAt } from './rates';
import { isBrakeVan, parseWagonText, type WagonDetail } from './wagon-details';
import { saveBlob, safeFile } from './backload';

export type RRContainer = { wagonType: string; wagonNumber: string; number: string; size: 20 | 40; le: 'L' | 'E'; pos: string; cmdt: string; trfc: string; tare: number | null; actual: number | null; gross: number; freight: number; calculated: number };
export type RRRecord = {
  id: string; fileName: string; rrNo: string; rrDate: string; from: string; to: string; distance: number; chargedWeight: number;
  freight: number; dpcn: number; ds: number; gst: number; totalFreight: number; commodity: string; loaded: boolean;
  wagons: WagonDetail[]; containers: RRContainer[]; declaredWagons: number; otherCharges: RRCharge[];
};
export type RRCharge = { code: string; name: string; amount: number };
export const CHARGE_NAMES: Record<string, string> = { TAC: 'Terminal Access Charge', ENHC: 'Engine Hiring Charge', BSC: 'Busy Season Charge', DC: 'Development Charge', SC: 'Surcharge', POL: 'Port Congestion / POL Charge', SDC: 'Siding Charge', STC: 'Station to Station Charge', WMC: 'Weighment Charge', DEM: 'Demurrage', WHF: 'Wharfage' };
export type RRAudit = { extras: number; standardTotal: number; base: number; containerBase: number; emptyWagons: number; emptyWagonRate: number; dpcn: number; ds: number; gst: number; total: number; difference: number; reconciled: boolean };

const num = (s: string | undefined) => { const n = Number(String(s ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rate for one container under the 2018 circular — same multipliers as the haulage generator. */
export function containerFreight(distance: number, size: 20 | 40, le: 'L' | 'E', pos: string, gross: number) {
  const r = ratesAt(distance); if (!r) return 0;
  const ud = /UD/i.test(pos);
  if (le === 'E') return round2((r[5] ?? 0) * (size === 40 ? (ud ? 0.9 : 1.8) : (ud ? 0.5 : 1)));
  if (size === 20) { const i = gross <= 10 ? 0 : gross <= 20 ? 1 : gross <= 26 ? 2 : gross <= 31 ? 3 : 4; return r[i] ?? 0; }
  return round2((r[gross <= 20 ? 0 : 1] ?? 0) * (ud ? 0.9 : 1.8));
}

/** Haulage reconciliation: 10% DPCN, 5% DS on freight+DPCN, 5% GST on taxable (rupee-rounded up). */
export function auditRR(rr: RRRecord): RRAudit {
  const containerBase = round2(rr.containers.reduce((s, c) => s + c.calculated, 0));
  const used = new Set(rr.containers.map(c => c.wagonNumber));
  const emptyWagons = rr.wagons.filter(w => !isBrakeVan(w.type) && !used.has(w.number)).length;
  const emptyWagonRate = (ratesAt(rr.distance)?.[6] ?? 0) * 2;
  const base = round2(containerBase + emptyWagons * emptyWagonRate);
  const dpcn = round2(base * 0.1); const ds = round2((base + dpcn) * 0.05);
  // Extra RR charges (TAC, ENHC, …) are outside the 2018 circular; they are added to the GST taxable value but not to the DS base.
  const extras = round2((rr.otherCharges ?? []).reduce((s, c) => s + c.amount, 0));
  const totalWith = (x: number) => { const taxable = Math.ceil(round2(base + dpcn + ds + x)); const g = Math.ceil(round2(taxable * 0.05)); return { g, t: Math.ceil(round2(base + dpcn + ds + x + g)) }; };
  const std = totalWith(0); const all = totalWith(extras); const gst = all.g; const total = all.t;
  const difference = round2(rr.totalFreight - total);
  return { extras, standardTotal: std.t, base, containerBase, emptyWagons, emptyWagonRate, dpcn, ds, gst, total, difference, reconciled: Math.abs(difference) <= 2 };
}

export const sizeCounts = (rr: RRRecord) => { const twenty = rr.containers.filter(c => c.size === 20).length; const forty = rr.containers.length - twenty; return { twenty, forty, teus: twenty + forty * 2 }; };

export function parseRRText(text: string, fileName = ''): RRRecord {
  const flat = text.replace(/[ \t]+/g, ' ');
  const pick = (re: RegExp) => flat.match(re)?.[1]?.trim() ?? '';
  const commodity = pick(/Commodity Description:\s*([^\n]+?)\s*(?:\n|$)/i);
  const loaded = !/EMPTY\s+HAULAGE/i.test(commodity) && /DEMAND|CONTAINER/i.test(commodity);
  const charge = (code: string) => num(flat.match(new RegExp(`(?:^|\\n)\\s*\\*?${code}\\s+([\\d.,]+)`, 'i'))?.[1]);
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim());
  const sectionAt = (re: RegExp) => lines.findIndex(l => re.test(l));
  const wagonStart = sectionAt(/Wagon details of the Railway Receipt/i);
  const freightStart = sectionAt(/FREIGHT DETAILS OF THE RR/i);
  const loadingStart = sectionAt(/LOADING DETAILS OF THE RR/i);
  const punitive = sectionAt(/PUNITIVE DETAILS OF THE RR/i);
  const end = (from: number, ...next: number[]) => Math.min(...next.filter(n => n > from), lines.length);
  const wagonLines = wagonStart >= 0 ? lines.slice(wagonStart, end(wagonStart, freightStart, loadingStart, punitive)) : [];
  const wagons = parseWagonText(wagonLines.join('\n')).rows;

  const containers: RRContainer[] = [];
  const distance = num(pick(/Distance \(In KM\):\s*([\d.]+)/i));
  if (freightStart >= 0) {
    const block = lines.slice(freightStart, end(freightStart, loadingStart, punitive));
    // Cntr Cmdt is blank for empty containers; some RRs print 6-digit container serials.
    const re = /^\d+ [A-Z]{2,5} \d{3} (BL[A-Z0-9]*|BV[A-Z0-9]*) (\d{6,11}) ([A-Z]{4}[A-Z0-9]{6,9}) (20|40) ([LE]) (LD|UD) (?:(\S+) )?(\S+) \d{4} [\d.]+ [\d.]+ ([\d.]+) ([\d.]+)$/;
    for (let i = 0; i < block.length; i++) {
      const m = block[i]?.match(re); if (!m) continue;
      let [, type = '', wagon = ''] = m;
      const wrap = block[i + 1]?.match(/^([A-Z]{0,3}) ?(\d{2,5})$/);
      if (wrap && wagon.length < 11) { type += wrap[1] ?? ''; wagon += wrap[2] ?? ''; i++; }
      const size = Number(m[4]) as 20 | 40; const le = m[5] as 'L' | 'E'; const gross = num(m[9]);
      containers.push({ wagonType: type, wagonNumber: wagon, number: m[3] ?? '', size, le, pos: m[6] ?? '', cmdt: m[7] ?? '', trfc: m[8] ?? '', tare: null, actual: null, gross, freight: num(m[10]), calculated: containerFreight(distance, size, le, m[6] ?? '', gross) });
    }
  }
  if (loadingStart >= 0) {
    const block = lines.slice(loadingStart, end(loadingStart, punitive));
    for (const line of block) {
      const m = line.match(/([A-Z]{4}[A-Z0-9]{6,9}) (20|40) ([LE]) (LD|UD) (.+)$/); if (!m) continue;
      const tokens = (m[5] ?? '').split(' '); const code = tokens.findIndex(t => /^\d{4}$/.test(t)); if (code < 0) continue;
      const values = tokens.slice(code + 1).map(Number).filter(Number.isFinite);
      const c = containers.find(x => x.number === m[1]); if (!c || values.length < 3) continue;
      c.tare = values[0] ?? null;
      if (values.length >= 4) { c.actual = values[1] ?? null; c.gross = values[2] ?? c.gross; }
      else c.gross = values[1] ?? c.gross;
    }
  }
  for (const c of containers) if (c.actual === null && c.tare !== null) c.actual = round2(c.gross - c.tare);
  const known = new Set(['DPCN', 'DS', 'GST']);
  const otherStart = sectionAt(/^Other Charges/i); const totalAt = sectionAt(/^Total Freight:/i);
  const otherCharges: RRCharge[] = otherStart >= 0 && totalAt > otherStart ? lines.slice(otherStart + 1, totalAt).flatMap(l => {
    const m = l.match(/^\*?([A-Z]{2,6}) (-?[\d.,]+)$/); if (!m || known.has(m[1]!)) return [];
    return [{ code: m[1]!, name: CHARGE_NAMES[m[1]!] ?? 'Other charge', amount: num(m[2]) }];
  }) : [];
  return {
    declaredWagons: num(pick(/Wagons:\s*(\d+)/i)), otherCharges,
    id: crypto.randomUUID(), fileName, rrNo: pick(/RR No:\s*(\d+)/i), rrDate: pick(/RR Date:\s*([\d-]+)/i), from: pick(/Station From:\s*([A-Z]+)/i), to: pick(/Station To:\s*([A-Z]+)/i),
    distance, chargedWeight: num(pick(/Chargeable Weight at\s*([\d.]+)/i)), freight: num(pick(/Freight:\s*Rs\s*([\d.,]+)/i)),
    dpcn: charge('DPCN'), ds: charge('DS'), gst: charge('GST'), totalFreight: num(pick(/Total Freight:\s*Rs\s*([\d.,]+)/i)), commodity, loaded, wagons, containers,
  };
}

export async function pdfText(data: Uint8Array) {
  const pdfjs = await import('pdfjs-dist'); const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default; pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const task = pdfjs.getDocument({ data, useSystemFonts: true }); const doc = await task.promise;
  try {
    let text = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent(); const rows = new Map<number, { x: number; s: string }[]>();
      for (const item of content.items) { if (!('str' in item) || !item.str.trim()) continue; const y = Math.round(item.transform[5]); const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y; const row = rows.get(key) ?? []; row.push({ x: item.transform[4], s: item.str }); rows.set(key, row); }
      text += [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(i => i.s).join(' ')).join('\n') + '\n';
    }
    return text;
  } finally { await task.destroy(); }
}

export async function readRRPdf(file: File) {
  const rr = parseRRText(await pdfText(new Uint8Array(await file.arrayBuffer())), file.name);
  if (!rr.rrNo) throw new Error(`${file.name}: no RR number found. Use a text-based eT-RR PDF.`);
  return rr;
}

type Col<T> = { key: string; label: string; get: (v: T) => string | number | null };
const rrCol = (key: string, label: string, get: (r: RRRecord) => string | number | null): Col<RRRecord> => ({ key, label, get });
export const RR_COLUMNS: Col<RRRecord>[] = [
  rrCol('rrNo', 'RR No', r => r.rrNo), rrCol('rrDate', 'RR Date', r => r.rrDate), rrCol('from', 'From', r => r.from), rrCol('to', 'To', r => r.to),
  rrCol('distance', 'Distance (KM)', r => r.distance), rrCol('chargedWeight', 'Charged Weight (T)', r => r.chargedWeight), rrCol('freight', 'Freight', r => r.freight),
  rrCol('dpcn', 'DPCN', r => r.dpcn), rrCol('ds', 'DS', r => r.ds), rrCol('gst', 'GST', r => r.gst), rrCol('totalFreight', 'Total Freight Amount', r => r.totalFreight),
  rrCol('wagons', 'Total Wagons', r => r.wagons.length), rrCol('wagonTypes', 'Wagon Types', r => [...new Set(r.wagons.map(w => w.type))].join(', ')),
  rrCol('wagonNumbers', 'Wagon Numbers', r => r.wagons.map(w => w.number).join(', ')), rrCol('commodity', 'Commodity', r => r.commodity),
  rrCol('loaded', 'Containers Loaded', r => r.loaded ? 'Yes' : 'No'), rrCol('twenty', "20' Containers", r => sizeCounts(r).twenty), rrCol('forty', "40' Containers", r => sizeCounts(r).forty),
  rrCol('teus', 'Total TEUs', r => sizeCounts(r).teus), rrCol('calculated', 'Calculated Total', r => auditRR(r).total), rrCol('difference', 'Difference', r => auditRR(r).difference),
  rrCol('otherCharges', 'Extra RR Charges', r => (r.otherCharges ?? []).map(c => `${c.code} ${c.amount}`).join(', ')),
  rrCol('standardTotal', 'Circular Total (excl. extras)', r => auditRR(r).standardTotal),
  rrCol('warnings', 'Validation Warnings', r => validateRR(r).length),
  rrCol('status', 'Haulage Status', r => auditRR(r).reconciled ? 'Matched' : 'Mismatch'),
];
type Row = { rr: RRRecord; c: RRContainer };
const cCol = (key: string, label: string, get: (r: Row) => string | number | null): Col<Row> => ({ key, label, get });
export const CONTAINER_COLUMNS: Col<Row>[] = [
  cCol('rrNo', 'RR No', r => r.rr.rrNo), cCol('wagonType', 'Wagon Type', r => r.c.wagonType), cCol('wagonNumber', 'Wagon Number', r => r.c.wagonNumber), cCol('number', 'Container Number', r => r.c.number),
  cCol('size', 'Cntr Size', r => r.c.size), cCol('le', 'Cntr L/E', r => r.c.le), cCol('pos', 'Cntr Pos', r => r.c.pos), cCol('cmdt', 'Cntr Cmdt', r => r.c.cmdt), cCol('trfc', 'Trfc Type', r => r.c.trfc),
  cCol('tare', 'Cntr Tare(T)', r => r.c.tare), cCol('actual', 'Actl Wt(T)', r => r.c.actual), cCol('gross', 'Grss Wt(T)', r => r.c.gross), cCol('freight', 'RR Freight', r => r.c.freight), cCol('calculated', 'Calculated Freight', r => r.c.calculated),
];

export async function exportRRWorkbook(records: RRRecord[], rrKeys: string[], containerKeys: string[], name: string) {
  if (!records.length) throw new Error('Upload at least one RR.');
  const { default: ExcelJS } = await import('exceljs'); const book = new ExcelJS.Workbook();
  const write = <T,>(title: string, cols: Col<T>[], rows: T[]) => {
    const sheet = book.addWorksheet(title); if (!cols.length) return;
    sheet.addRow(cols.map(c => c.label)); rows.forEach(r => sheet.addRow(cols.map(c => c.get(r))));
    sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    sheet.eachRow(row => row.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; }));
    cols.forEach((c, i) => { sheet.getColumn(i + 1).width = c.key === 'wagonNumbers' ? 60 : Math.max(12, c.label.length + 4); });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  };
  write('RR Summary', RR_COLUMNS.filter(c => rrKeys.includes(c.key)), records);
  write('Container Details', CONTAINER_COLUMNS.filter(c => containerKeys.includes(c.key)), records.flatMap(rr => rr.containers.map(c => ({ rr, c }))));
  if (records.length === 1) {
    const rr = records[0]!; const sheet = book.addWorksheet('Wagon Details'); sheet.addRow(['S.NO.', 'WAGON NUMBER', 'TYPE']).font = { bold: true };
    rr.wagons.forEach(w => sheet.addRow([w.sn, w.number, w.type])); sheet.getColumn(2).width = 18;
  }
  saveBlob(new Blob([await book.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeFile(name)}.xlsx`);
}

export type RRIssue = { scope: 'wagon' | 'container' | 'weight'; ref: string; message: string };
/** Offline pre-export checks for missing or suspicious values. Advisory only; exports stay allowed. */
export function validateRR(rr: RRRecord): RRIssue[] {
  const out: RRIssue[] = []; const add = (scope: RRIssue['scope'], ref: string, message: string) => out.push({ scope, ref, message });
  if (rr.declaredWagons && rr.declaredWagons !== rr.wagons.length) add('wagon', 'Rake', `RR states ${rr.declaredWagons} wagons but ${rr.wagons.length} were read`);
  const seen = new Set<string>();
  for (const w of rr.wagons) {
    if (!/^\d{11}$/.test(w.number)) add('wagon', w.number || `S.No ${w.sn}`, 'Wagon number is not 11 digits');
    if (!w.type) add('wagon', w.number, 'Wagon type missing');
    if (seen.has(w.number)) add('wagon', w.number, 'Duplicate wagon number'); seen.add(w.number);
  }
  if (rr.loaded && !rr.containers.length) add('container', 'Rake', 'Commodity shows a loaded rake but no containers were read');
  const wagonSet = new Set(rr.wagons.map(w => w.number)); const cSeen = new Set<string>();
  for (const c of rr.containers) {
    if (!/^[A-Z]{4}\d{7}$/.test(c.number)) add('container', c.number, 'Container number is not 4 letters + 7 digits');
    if (cSeen.has(c.number)) add('container', c.number, 'Duplicate container number'); cSeen.add(c.number);
    if (!/^\d{11}$/.test(c.wagonNumber) || (wagonSet.size && !wagonSet.has(c.wagonNumber))) add('container', c.number, `Wagon ${c.wagonNumber || '(blank)'} not found in wagon details`);
    if (c.size === 20 && c.pos === 'UD') add('container', c.number, "20' container cannot be on Upper Deck");
    if (!(c.gross > 0)) add('weight', c.number, 'Gross weight missing or zero');
    if (c.tare === null || !(c.tare > 0)) add('weight', c.number, 'Tare weight missing');
    else if (c.size === 20 ? c.tare < 1.5 || c.tare > 3.5 : c.tare < 3 || c.tare > 5) add('weight', c.number, `Unusual tare ${c.tare} T for ${c.size}ft`);
    if (c.tare !== null && c.gross > 0 && c.gross < c.tare) add('weight', c.number, 'Gross weight is below tare');
    if (c.le === 'E' && c.actual !== null && c.actual > 0.5) add('weight', c.number, `Empty container carries ${c.actual} T cargo`);
    if (c.le === 'L' && c.actual !== null && c.actual <= 0) add('weight', c.number, 'Loaded container has no cargo weight');
    if (c.gross > 40) add('weight', c.number, `Gross ${c.gross} T is unusually high`);
  }
  return out;
}
