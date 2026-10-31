import * as XLSX from 'xlsx';
import backloadTemplate from '@/haulage/assets/backload-template.xlsx?url';
export type PendingContainer = { id: string; number: string; terminal: string; line: string; smtp: string; smtpDate: string; size: 20 | 40; gross: number; dwell: number; vessel?: string; source: 'FOIS' | 'MICT' };
export type RakeConfig = { rakeName: string; wagons: number; wagonType: string; stack: 'Single' | 'Double'; origin: string; destination: string };
export const blankConfig = (): RakeConfig => ({ rakeName: 'CWC ', wagons: 45, wagonType: 'BLCM', stack: 'Single', origin: 'MDCC', destination: '' });
export function normalizedDate(value: unknown): string {
  if (typeof value === 'number') { const d = XLSX.SSF.parse_date_code(value); return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : ''; }
  const s = String(value ?? '').trim(); if (!s) return '';
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})(?:\D|$)/);
  const iso = m ? `${m[3]?.length === 2 ? '20' : ''}${m[3]}-${m[2]?.padStart(2,'0')}-${m[1]?.padStart(2,'0')}` : s.slice(0,10);
  const d = new Date(`${iso}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === iso ? iso : '';
}
export const displayDate = (value: string) => value ? value.split('-').reverse().join('.') : '';
export function parsePendencyRows(rows: Record<string, unknown>[], source: 'FOIS' | 'MICT'): PendingContainer[] {
  const get = (row: Record<string, unknown>, key: string) => Object.entries(row).find(([k]) => k.trim().toLowerCase() === key.toLowerCase())?.[1];
  return rows.flatMap((row, index) => {
    const read = (fois: string, mict: string) => get(row, source === 'MICT' ? mict : fois);
    const number = String(read('ctrNumber','Container No') ?? '').trim();
    const size = Number(String(read('ctrSize','Container Size') ?? '').match(/20|40/)?.[0]);
    if (!number || (size !== 20 && size !== 40)) return [];
    const rawWeight = Number(String(read('ctrGrossWt','Gross Weight/VGM') ?? 0).replaceAll(',','')) || 0;
    return [{ id: `${source}-${index}-${number}`, number, size, terminal: source === 'MICT' ? 'MICT' : String(get(row,'terminalCode') ?? ''), line: String(read('lineAgent','Box Operator') ?? ''), smtp: String(read('smtpNumber','Agent Reference No') ?? get(row,'Agent Reference Id') ?? '').trim(), smtpDate: normalizedDate(get(row,'smtpDate') ?? get(row,'SMTP Date')), gross: rawWeight > 1000 ? rawWeight / 1000 : rawWeight, dwell: Math.max(0,Number(read('dwelDays','Dwell days')) || 0), source }];
  });
}
export async function readPendency(file: File): Promise<PendingContainer[]> {
  const book = XLSX.read(await file.arrayBuffer(), { type:'array' });
  const sheet = book.Sheets['Pendency-report'] ?? book.Sheets[book.SheetNames[0] ?? ''];
  if (!sheet) throw new Error('No pendency sheet found.');
  const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet, { defval:'' });
  const source = rows.some(r => Object.keys(r).some(k => k.trim() === 'Container No')) ? 'MICT' : 'FOIS';
  const containers = parsePendencyRows(rows, source);
  if (!containers.length) throw new Error('No containers found. Check the pendency report headers.');
  return containers;
}
export const eligible = (c: PendingContainer) => Boolean(c.smtp.trim() && (c.smtpDate || c.source === 'MICT'));
const natural = (a: string,b: string) => a.localeCompare(b,'en',{ numeric:true });
export function fifo(a: PendingContainer,b: PendingContainer) {
  // Undated MICT references are considered after dated references, then numerically.
  return (a.smtpDate || '9999-12-31').localeCompare(b.smtpDate || '9999-12-31') || natural(a.smtp,b.smtp) || natural(a.number,b.number);
}
export function makePlan(pool: PendingContainer[], config: RakeConfig) {
  const capacity = Math.max(0,Math.floor(config.wagons)) * (config.stack === 'Double' ? 4 : 2);
  const sorted = pool.filter(eligible).sort(fifo);
  // Choose maximum even TEUs, then the earliest feasible FIFO subset.
  let twenties=sorted.filter(c=>c.size===20).length, forties=sorted.length-twenties;
  const feasible=(target:number,n20:number,n40:number)=>{
    if(target<0)return false;
    let minimum=Math.max(0,target-2*n40); if(minimum%2!==target%2)minimum++;
    return minimum<=Math.min(n20,target);
  };
  let used=Math.min(capacity,twenties+2*forties);if(used%2)used--;
  while(used>0&&!feasible(used,twenties,forties))used-=2;
  let remaining=used;const selected:PendingContainer[]=[];
  for(const c of sorted){const units=c.size===40?2:1;if(c.size===20)twenties--;else forties--;
    if(remaining>=units&&feasible(remaining-units,twenties,forties)){selected.push(c);remaining-=units;}
  }
  const ids = new Set(selected.map(c => c.id));
  return { capacity, used, selected, remaining: sorted.filter(c => !ids.has(c.id)), excluded: pool.filter(c => !eligible(c)) };
}
export function groupPlan(selected: PendingContainer[], pool: PendingContainer[]) {
  const groups = new Map<string, { vessel:string; terminal:string; line:string; smtp:string; smtpDate:string; twenty:number; forty:number; dwell:number }>();
  for (const c of selected) {
    const key = JSON.stringify([c.terminal,c.line,c.smtp,c.smtpDate,c.vessel??'']);
    const g = groups.get(key) ?? { vessel:c.vessel??'',terminal:c.terminal,line:c.line,smtp:c.smtp,smtpDate:c.smtpDate,twenty:0,forty:0,dwell:Math.max(...pool.filter(p => p.smtp === c.smtp).map(p => p.dwell),0) };
    if (c.size === 20) g.twenty++; else g.forty++; groups.set(key,g);
  }
  return [...groups.values()];
}
export function saveBlob(blob: Blob,name: string) { const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000); }
export const safeFile = (name:string) => name.replace(/[^\w-]+/g,'_');
export async function exportBackload(pool: PendingContainer[],config: RakeConfig) {
  const { default: ExcelJS } = await import('exceljs'); const book=new ExcelJS.Workbook();
  await book.xlsx.load(await(await fetch(backloadTemplate)).arrayBuffer());
  const sheet=book.getWorksheet('FINAL DS');if(!sheet)throw new Error('Backload template is missing.');
  const dataStyles=Array.from({length:10},(_,i)=>structuredClone(sheet.getCell(6,i+2).style));
  const totalStyles=Array.from({length:10},(_,i)=>structuredClone(sheet.getCell(15,i+2).style));
  const noteStyle=structuredClone(sheet.getCell('B17').style);const note=String(sheet.getCell('B17').value??'');
  for(const merge of [...sheet.model.merges])sheet.unMergeCells(merge);
  for(let r=6;r<=sheet.rowCount;r++)for(let c=1;c<=11;c++)sheet.getCell(r,c).value=null;
  sheet.mergeCells('B3:K3');sheet.getCell('B3').value=`BACKLOADING PLAN OF ${config.rakeName} ${config.origin} TO ${config.destination} (${config.wagons} ${config.wagonType}) ${config.stack.toUpperCase()} STACK`;
  const plan=makePlan(pool,config);if(!plan.selected.length)throw new Error('No eligible containers fit the rake capacity and even 20ft total.');
  const groups=groupPlan(plan.selected,pool);
  groups.forEach((g,i)=>{const r=i+6;sheet.getRow(r).height=17.4;
    [g.terminal,g.vessel,g.line,g.smtp,displayDate(g.smtpDate),g.twenty,g.forty,{formula:`G${r}+2*H${r}`,result:g.twenty+2*g.forty},'INWPG',g.dwell].forEach((v,j)=>{const cell=sheet.getCell(r,j+2);cell.style=structuredClone(dataStyles[j]??{});cell.value=v;});
  });
  const end=5+groups.length,total=end+1;
  for(let j=0;j<10;j++)sheet.getCell(total,j+2).style=structuredClone(totalStyles[j]??{});
  sheet.getRow(total).height=18;sheet.getCell(total,6).value='TOTAL';
  for(const [col,result]of [['G',plan.selected.filter(c=>c.size===20).length],['H',plan.selected.filter(c=>c.size===40).length],['I',plan.used]]as const)sheet.getCell(`${col}${total}`).value={formula:`SUM(${col}6:${col}${end})`,result};
  sheet.mergeCells(`B${total+2}:K${total+2}`);sheet.getCell(total+2,2).style=noteStyle;sheet.getCell(total+2,2).value=note;sheet.getRow(total+2).height=43.2;
  sheet.pageSetup.printArea=`B3:K${total+2}`;
  saveBlob(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`Backload_Plan_${safeFile(config.rakeName)}.xlsx`);
}
