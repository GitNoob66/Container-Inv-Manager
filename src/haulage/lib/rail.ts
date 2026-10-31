import * as XLSX from 'xlsx';
import { openDB } from 'idb';
import ExcelJS from 'exceljs';
import { ratesAt, slab } from './rates';

export type Container = { wagon: string; number: string; size: 20 | 40; gross: number; tare: number; commodity: string; empty: boolean; position?: string; isoCode?: string; smtp?: string; smtpDate?: string; line?: string; category?: string; status?: string; destination?: string; hsn?: string; type?: string };
export type Trip = { id: string; createdAt: string; fileName: string; trainNumber: string; rakeName: string; origin: string; destination: string; distance: number; counts: number[]; bvzcRate: number; bookingGstin?: string; destinationGstin?: string; dpcn?: number; dc?: number; gst?: number; underframeWagons?: string[]; containers: Container[] };
export const GSTIN = '07AAACC1206D3ZG';
export const CATEGORIES = ["20' Loaded Containers- upto 10MT", "20' Loaded Containers- Above 10MT and upto 20MT", "40' Loaded Containers- upto 20MT (LD)", "40' Loaded Containers- Above 20MT and upto 40MT (LD)", "40' Loaded Containers- upto 20MT (UD)", "40' Loaded Containers- Above 20MT and upto 40MT (UD)", 'BVZC', "20' Loaded Containers- Above 20MT and upto 26MT", "20' Loaded Containers- Above 26MT and upto 31MT", "20' Loaded Containers- Above 31MT", "20' Empty Containers (LD)", "20' Empty Containers (UD)", "40' Empty Containers (LD)", "40' Empty Containers (UD)", 'Underframe'] as const;
// Index 11 is retained for backward-compatible saved trips, but 20-foot empties are always lower deck.
export const CATEGORY_ORDER = [0,1,7,8,9,2,3,4,5,10,12,13,14,6] as const;
const text = (value: unknown) => String(value ?? '').trim();
const numeric = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const normalize = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export const newTrip = (): Trip => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), fileName: '', trainNumber: '', rakeName: 'CWC ', origin: 'MDCC', destination: '', distance: 0, counts: Array(CATEGORIES.length).fill(0), bvzcRate: 0, bookingGstin: GSTIN, destinationGstin: GSTIN, dpcn: 10, dc: 5, gst: 5, underframeWagons: [], containers: [] });
export function category(c: Container): number {
  if (c.empty) return c.size === 20 ? 10 : 12 + (/upper|^ud$/i.test(c.position ?? '') ? 1 : 0);
  if (c.size === 20) return c.gross <= 10 ? 0 : c.gross <= 20 ? 1 : c.gross <= 26 ? 7 : c.gross <= 31 ? 8 : 9;
  const upper = /upper|^ud$/i.test(c.position ?? '');
  return (upper ? 4 : 2) + (c.gross <= 20 ? 0 : 1);
}
export function tripCounts(trip: Trip): number[] { const counts = [...(trip.counts ?? [])]; if (!counts.length) for (const c of trip.containers) counts[category(c)] = (counts[category(c)] ?? 0) + 1; while (counts.length < CATEGORIES.length) counts.push(0); counts[10] = (counts[10] ?? 0) + (counts[11] ?? 0); counts[11] = 0; counts[14] = trip.underframeWagons?.length ?? counts[14] ?? 0; return counts; }
// Apply manifest changes as category deltas, preserving any independently entered wagon counts.
export function changeContainer(trip: Trip, index: number | null, container?: Container): Trip {
  const containers = [...trip.containers];
  const old = index === null ? undefined : containers[index];
  if (index !== null && !old) return trip;
  if (container && containers.some((c, i) => i !== index && c.number.toUpperCase() === container.number.toUpperCase())) throw new Error('Container number must be unique in this rake.');
  const counts = tripCounts(trip);
  if (old) counts[category(old)] = Math.max(0, (counts[category(old)] ?? 0) - 1);
  if (container) counts[category(container)] = (counts[category(container)] ?? 0) + 1;
  if (index === null) { if (container) containers.push(container); }
  else if (container) containers[index] = container;
  else containers.splice(index, 1);
  return { ...trip, containers, counts };
}
export async function parseRailFile(file: File): Promise<Trip> {
  if (!/\.xlsx?$/i.test(file.name)) throw new Error('Choose an .xls or .xlsx report.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', dense: true, cellText: true });
  const matrices = workbook.SheetNames.map(name => workbook.Sheets[name]).filter((sheet): sheet is XLSX.WorkSheet => Boolean(sheet)).map(sheet => XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' }));
  const trip = newTrip(); trip.fileName = file.name;
  const allText = matrices.flat().flat().map(text);
  const reportDate = allText.find(value => /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/.test(value));
  const dateParts = reportDate?.match(/\b(\d{1,2})([./-])(\d{1,2})[./-](\d{4})\b/);
  if (dateParts) {
    const first = Number(dateParts[1]), second = Number(dateParts[3]);
    const monthFirst = dateParts[2] === '/' && (second > 12 || first <= 12);
    const day = monthFirst ? second : first, month = monthFirst ? first : second;
    trip.createdAt = new Date(Number(dateParts[4]), month - 1, day, 12).toISOString();
  }
  for (const rows of matrices) {
    for (const row of rows) for (let i=0; i<row.length; i++) if (/CTO\s*TRAIN\s*NUMBER/i.test(text(row[i]))) { trip.trainNumber = text(row.slice(i+1).find(cell => text(cell))); trip.rakeName = /^CWC\b/i.test(trip.trainNumber) ? trip.trainNumber : `CWC ${trip.trainNumber}`; }
    for (let h=0; h<rows.length; h++) {
      const headers = (rows[h] || []).map(normalize);
      const col = (names: string[]) => headers.findIndex(v => names.some(n => v === n || v.startsWith(n)));
       const ix = { number: col(['containernumber','containerno','containerid']), wagon: col(['wagon','wagonno','wagonnumber']), size: col(['size','ctsize']), iso: col(['isocode','iso']), gross: col(['weight','grossweight','grosswt']), tare: col(['tare','cttare']), commodity: col(['commodity','contcommodity']), status: col(['status','le']), slot: col(['slot','position']), smtp: col(['smtpnbr','smtpno']), smtpDate: col(['smtpdate','smtpdt']), line: col(['shippingline','sline']), destination: col(['destination','destn']), hsn: col(['hsncode']), type: col(['type']) };
      if (ix.number < 0 || ix.wagon < 0 || ix.number === ix.wagon) continue;
      for (let i=h+1; i<rows.length; i++) {
        const row = rows[i] || []; const val = (key: keyof typeof ix) => ix[key] < 0 ? '' : row[ix[key]];
        const number = text(val('number')), wagon = text(val('wagon'));
        if (!number || /^(total|summary|grand|wagon|container)/i.test(number)) { if (trip.containers.length) break; continue; }
        if (!/^[A-Z0-9/-]{5,}$/i.test(number) || !wagon) continue;
        const rawGross = numeric(val('gross')), rawTare = numeric(val('tare'));
        // FOIS outbound weights are kilograms; the calculation workbook uses tonnes.
        const gross = rawGross > 1000 ? rawGross / 1000 : rawGross;
        const tare = rawTare > 1000 ? rawTare / 1000 : rawTare;
        const slot = text(val('slot'));
        const position = /^\d*T/i.test(slot) || /upper/i.test(slot) ? 'Upper' : 'Lower';
        const status = text(val('status'));
        const isEmpty = /^(?:empty|emp|mt|mty|e)(?:\b|$)/i.test(status);
         const container: Container = { wagon, number, size: /40|45/.test(text(val('size'))) ? 40 : 20, isoCode: text(val('iso')), gross, tare: tare || (/40|45/.test(text(val('size'))) ? 3.8 : 2.5), commodity: text(val('commodity')) || '—', empty: isEmpty, position, smtp: text(val('smtp')), smtpDate: text(val('smtpDate')), line: text(val('line')), status, destination: text(val('destination')), hsn: text(val('hsn')), type: text(val('type')) };
        if (!trip.containers.some(c => c.number === number && c.wagon === wagon)) trip.containers.push(container);
      }
      if (trip.containers.length) break;
    }
    if (trip.containers.length) break;
  }
  if (!trip.containers.length) throw new Error('No container rows found. The report needs Wagon and Container column headings.');
  trip.counts = tripCounts({ ...trip, counts: [] });
  return trip;
}
export const teusFor = (trip: Trip, i: number) => (tripCounts(trip)[i] ?? 0) * (i === 14 ? 0 : [2,3,4,5,12,13].includes(i) ? 2 : 1);
export const teu = (trip: Trip) => CATEGORIES.reduce((sum, _, i) => sum + teusFor(trip,i), 0);
export const baseRateFor = (trip: Trip, i: number) => i === 6 ? trip.bvzcRate || 0 : ratesAt(trip.distance)?.[i === 14 ? 6 : i >= 10 ? 5 : i === 0 || i === 2 || i === 4 ? 0 : i === 1 || i === 3 || i === 5 ? 1 : i - 5] ?? 0;
export const rateFor = (trip: Trip, i: number) => baseRateFor(trip, i) * (i === 14 ? 2 : [2,3,12].includes(i) ? 1.8 : [4,5,13].includes(i) ? .9 : i === 11 ? .5 : 1);
export const lineTotal = (trip: Trip, i: number) => (tripCounts(trip)[i] ?? 0) * rateFor(trip, i);
export const baseHaulage = (trip: Trip) => CATEGORIES.reduce((sum, _, i) => sum + lineTotal(trip, i), 0);
export const charges = (trip: Trip) => { const base = baseHaulage(trip); const dpcn = base * (trip.dpcn ?? 10) / 100; const freight = base + dpcn; const dc = freight * (trip.dc ?? 5) / 100; const beforeGst = freight + dc; const gst = beforeGst * (trip.gst ?? 5) / 100; return {base,dpcn,freight,dc,beforeGst,gst,total:beforeGst+gst}; };
export const payable = (trip: Trip) => charges(trip).total;
const db = () => openDB('rail-haulage-local', 1, { upgrade(database) { database.createObjectStore('trips', { keyPath: 'id' }); } });
export async function listTrips(): Promise<Trip[]> { return (await (await db()).getAll('trips')).sort((a: Trip, b: Trip) => b.createdAt.localeCompare(a.createdAt)); }
export async function saveTrip(trip: Trip) { await (await db()).put('trips', trip); }
export async function deleteTrip(id: string) { await (await db()).delete('trips', id); }

import haulageTemplate from '@/haulage/assets/haulage-template.xlsx?url';
import trainTemplate from '@/haulage/assets/train-template.xlsx?url';

async function template(url: string) { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await (await fetch(url)).arrayBuffer()); return wb; }
async function download(workbook: ExcelJS.Workbook, name: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const safeName = (value: string) => value.trim().replace(/[^\w-]+/g, '_');
const formula = (value: string, result?: number): ExcelJS.CellFormulaValue => result === undefined ? { formula: value.slice(1) } : { formula: value.slice(1), result };
export async function exportHaulage(trip: Trip) {
  if (!trip.distance) throw new Error('Enter distance before exporting haulage.');
  const wb = await template(haulageTemplate), ws = wb.worksheets[0];
  if (!ws) throw new Error('Haulage template is missing a worksheet.');
  ws.unMergeCells('D15:F15'); ws.unMergeCells('D19:F19');
  const counts = tripCounts(trip);
  const activeCategories = CATEGORY_ORDER.filter(i => i === 6 || (counts[i] ?? 0) > 0);
  const rowDelta = activeCategories.length - 7;
  if (rowDelta > 0) ws.spliceRows(13, 0, ...Array.from({ length: rowDelta }, () => Array(7).fill(null)));
  else if (rowDelta < 0) ws.spliceRows(6 + activeCategories.length, -rowDelta);
  const totalRow = 6 + activeCategories.length, freightRow = totalRow + 2, grandRow = totalRow + 6;
  ws.mergeCells(`D${freightRow}:F${freightRow}`); ws.mergeCells(`D${grandRow}:F${grandRow}`);
  for (let r=13; r<totalRow; r++) for (let c=2; c<=7; c++) ws.getRow(r).getCell(c).style = { ...ws.getRow(11).getCell(c).style };
  const set = (address: string, value: ExcelJS.CellValue) => { ws.getCell(address).value = value; };
  set('B3', `RAIL HAULAGE CALCULATION ${trip.rakeName} ${trip.origin} to ${trip.destination || '—'} ${new Date(trip.createdAt).toLocaleDateString('en-GB').replaceAll('/', '.')}`);
  set('B4', trip.distance); const range = slab(trip.distance); set('C4', range ? `${range.from}-${range.to}` : '');
  set('B5', trip.destination || 'DESTINATION');
  for (let rowIndex=0; rowIndex<activeCategories.length; rowIndex++) {
    const i = activeCategories[rowIndex] ?? 6, r = 6+rowIndex;
    set(`B${r}`, CATEGORIES[i] ?? 'BVZC');
    set(`C${r}`, baseRateFor(trip,i));
    set(`D${r}`, counts[i] ?? 0); set(`E${r}`, teusFor(trip,i));
    const multiplier = i === 14 ? '*2' : [2,3,12].includes(i) ? '*1.8' : [4,5,13].includes(i) ? '*1.8/2' : '';
    set(`F${r}`, formula(`=C${r}${multiplier}`, rateFor(trip, i)));
    set(`G${r}`, formula(`=F${r}*${[0,1,7,8,9,10,11].includes(i) ? 'E' : 'D'}${r}`, lineTotal(trip, i)));
  }
  const amount = charges(trip);
  const computed: Record<string, number> = { [`D${totalRow}`]: activeCategories.reduce<number>((sum,i) => sum + (counts[i] ?? 0),0), [`E${totalRow}`]: teu(trip), [`G${totalRow}`]: amount.base, [`G${totalRow+1}`]: amount.dpcn, [`G${freightRow}`]: amount.freight, [`G${totalRow+3}`]: amount.dc, [`G${totalRow+4}`]: amount.beforeGst, [`G${totalRow+5}`]: amount.gst, [`G${grandRow}`]: amount.total };
  set(`F${totalRow+1}`, (trip.dpcn ?? 10)/100); set(`E${totalRow+3}`, (trip.dc ?? 5)/100); set(`E${totalRow+5}`, (trip.gst ?? 5)/100);
  const expressions: Record<string,string> = { [`D${totalRow}`]:`=SUM(D6:D${totalRow-1})`, [`E${totalRow}`]:`=SUM(E6:E${totalRow-1})`, [`G${totalRow}`]:`=SUM(G6:G${totalRow-1})`, [`G${totalRow+1}`]:`=G${totalRow}*F${totalRow+1}`, [`G${freightRow}`]:`=SUM(G${totalRow}:G${totalRow+1})`, [`G${totalRow+3}`]:`=G${freightRow}*E${totalRow+3}`, [`G${totalRow+4}`]:`=G${freightRow}+G${totalRow+3}`, [`G${totalRow+5}`]:`=G${totalRow+4}*E${totalRow+5}`, [`G${grandRow}`]:`=G${freightRow}+G${totalRow+3}+G${totalRow+5}` };
  set(`B${totalRow}`, 'TOTAL'); set(`B${totalRow+1}`, 'DPCN'); set(`D${freightRow}`, 'FREIGHT TOTAL'); set(`B${totalRow+3}`, 'DC'); set(`B${totalRow+5}`, 'GST'); set(`D${grandRow}`, 'Grand Total FR');
  for (const [cell, expression] of Object.entries(expressions)) set(cell, formula(expression, computed[cell]));
  await download(wb, `Rail_Haulage_Calculation_${safeName(trip.rakeName)}.xlsx`);
}
export async function exportTrain(trip: Trip) {
  if (!trip.containers.length && !trip.underframeWagons?.length) throw new Error('Import a report or enter underframe wagons before exporting a train summary.');
  if (trip.underframeWagons?.some(wagon => !wagon.trim())) throw new Error('Enter every underframe wagon number before exporting the train summary.');
  const wb = await template(trainTemplate), ws = wb.worksheets[0];
  if (!ws) throw new Error('Train template is missing a worksheet.');
  // Clear the reference's sample manifest before shortening it, so no sample rows leak into new exports.
  for (let r=6;r<=89;r++) for (let c=2;c<=17;c++) ws.getRow(r).getCell(c).value=null;
  const total = trip.containers.length + (trip.underframeWagons?.length ?? 0) + 6;
  const oldTotal = 90;
  if (total > oldTotal) ws.spliceRows(oldTotal, 0, ...Array.from({ length: total - oldTotal }, () => Array(17).fill(null)));
  else if (total < oldTotal) ws.spliceRows(total, oldTotal - total);
  ws.getCell('B3').value = `Train No. ${trip.rakeName} ${trip.origin} to ${trip.destination || '—'} Dep Date ${new Date(trip.createdAt).toLocaleDateString('en-GB').replaceAll('/', '.')}`;
  ws.getCell('B4').value = `Booking station- ${trip.origin}  ${trip.bookingGstin ?? GSTIN}`;
  ws.getCell('K4').value = `Destination station - ${trip.destination || '—'} -  ${trip.destinationGstin ?? GSTIN}`;
  const exportedTares = trip.containers.map(c => c.size === 40 ? (Math.random() < .5 ? 3.8 : 3.83) : c.tare);
  for (let i=0; i<trip.containers.length; i++) {
    const c=trip.containers[i], r=i+6;
    if (!c) continue;
    const tare = exportedTares[i] ?? c.tare;
    const values: ExcelJS.CellValue[] = [i+1,c.wagon,c.number,String(c.size),c.smtp || '',c.position || 'Lower','NIGT OTHR',c.empty?'E':'L',c.line || '',c.commodity === 'GEN' ? 'Assorted Commodity' : c.commodity,c.type || 'EXIM',tare,formula(`=O${r}-M${r}`, c.gross-tare),c.gross,trip.destination || c.destination || '',c.hsn ? Number(c.hsn) || c.hsn : 98051000];
    values.forEach((value,j) => { const cell=ws.getRow(r).getCell(j+2); cell.value=value; if (r>89) { const source=ws.getRow(89).getCell(j+2); cell.style=source.style; } });
    ws.getRow(r).height=52.8;
  }
  (trip.underframeWagons ?? []).forEach((wagon,i) => {
    const r=trip.containers.length+6+i;
    for (let c=2;c<=17;c++) { const cell=ws.getRow(r).getCell(c); cell.style={...ws.getRow(89).getCell(c).style}; cell.value=c===2 ? trip.containers.length+i+1 : c===3 ? wagon : 'U/F'; }
    ws.getRow(r).height=52.8;
  });
  ws.getCell(`L${total}`).value = 'TOTAL';
  for (const col of ['M','N','O']) ws.getCell(`${col}${total}`).value=formula(`=SUM(${col}6:${col}${total-1})`, trip.containers.reduce((sum,c,i) => sum + (col === 'M' ? exportedTares[i] ?? c.tare : col === 'O' ? c.gross : c.gross-(exportedTares[i] ?? c.tare)), 0));
  // ExcelJS retains styled, empty sample rows after spliceRows; trim these from the serialized sheet.
  if (total < oldTotal) {
    const model = ws.model as ExcelJS.WorksheetModel & { rows?: Array<{ number: number }> };
    ws.model = { ...model, rows: model.rows?.filter(row => row.number <= total) } as ExcelJS.WorksheetModel;
    // Assigning the trimmed model discards ExcelJS's internal merge registry.
    // Reconstruct it by unmerging the model's dangling ranges, then merge anew.
    for (const range of ['B3:Q3', 'B4:J4', 'K4:Q4']) {
      ws.unMergeCells(range);
      ws.mergeCells(range);
    }
  }
  await download(wb, `Train_Summary_${safeName(trip.rakeName)}_${safeName(trip.origin)}_TO_${safeName(trip.destination)}.xlsx`);
}
