import { saveBlob,safeFile } from './backload';
import wagonTemplate from '@/haulage/assets/wagon-template.xlsx?url';
export type WagonDetail = { sn:number; number:string; type:string };
export const isBrakeVan = (type:string) => /^(BVCM|BVZC)$/i.test(type.trim());
export function wagonConfig(rows:WagonDetail[]) { const valid=rows.filter(r=>!isBrakeVan(r.type)); const types=[...new Set(valid.map(r=>r.type.trim()))];return {wagons:valid.length,wagonType:types.length===1?types[0]??'':types.join(' / ')}; }
export const orderWagons = (rows:WagonDetail[]) => [...rows].sort((a,b)=>Number(isBrakeVan(a.type))-Number(isBrakeVan(b.type))).map((r,i)=>({...r,sn:i+1}));
export function parseWagonText(text:string) {
  const rake=text.match(/CWC\s+([LR])-?\s*0*(\d+)/i);const rakeName=rake?`CWC ${rake[1]?.toUpperCase()}-${String(rake[2]).padStart(2,'0')}`:'';
  const rows:WagonDetail[]=[];const seen=new Set<string>();
  const lines=text.split('\n');
  for(let i=0;i<lines.length;i++){
    let line=lines[i]??'';
    const prefix=line.match(/\b(\d{8})\b/); const suffix=lines[i+1]?.trim().match(/^(\d{3})[A-Z]?(?:\s+\d{1,2})?$/);
    if(prefix&&suffix&&/\b(BL[A-Z0-9]+|BVZC|BVCM)\b/i.test(line)){line=line.replace(prefix[0],prefix[0]+suffix[1]);i++;}
    const numbers=[...line.matchAll(/\b(\d{11})\b/g)];
    for(const match of numbers){const number=match[1];if(!number||seen.has(number))continue;const at=match.index??0;const after=line.slice(at+11);const before=line.slice(0,at);const type=after.match(/\b(BL[A-Z0-9]+|BVZC|BVCM)\b/i)?.[1]??before.match(/\b(BL[A-Z0-9]+|BVZC|BVCM)\b/i)?.[1]??'';if(!type)continue;const serial=before.match(/(?:^|\s)(\d{1,3})\s*$/)?.[1];rows.push({sn:serial?Number(serial):rows.length+1,number,type:type.toUpperCase()});seen.add(number);}
  }
  return {rakeName,rows:orderWagons(rows)};
}
export async function readWagonPdf(file:File){
  const pdfjs=await import('pdfjs-dist');const worker=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=worker;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});const document=await task.promise;
  try{let text='';for(let i=1;i<=document.numPages;i++){const page=await document.getPage(i);const content=await page.getTextContent();const lines=new Map<number,{x:number;text:string}[]>();for(const item of content.items){if(!('str'in item))continue;const y=Math.round(item.transform[5]);const line=lines.get(y)??[];line.push({x:item.transform[4],text:item.str});lines.set(y,line);}text += [...lines.entries()].sort((a,b)=>b[0]-a[0]).map(([,line])=>line.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n')+'\n';}const result=parseWagonText(text);if(!result.rows.length)throw new Error('No wagon number/type pairs found. This PDF may be scanned; enter rows manually or use a text-based PDF.');return result;}finally{await task.destroy();}
}
export async function exportWagons(rows:WagonDetail[],rakeName:string){
  if(!rakeName.trim()||!rows.length||rows.some(r=>!/^\d{11}$/.test(r.number)||!r.type.trim()))throw new Error('Enter rake name and valid 11-digit wagon numbers/types.');
  if(new Set(rows.map(r=>r.number)).size!==rows.length)throw new Error('Duplicate wagon numbers must be corrected.');
  const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();await book.xlsx.load(await(await fetch(wagonTemplate)).arrayBuffer());const sheet=book.worksheets[0];if(!sheet)throw new Error('Wagon template missing.');
  const styles=[1,2,3].map(c=>structuredClone(sheet.getCell(2,c).style));const height=sheet.getRow(2).height;
  for(let r=2;r<=sheet.rowCount;r++)for(let c=1;c<=3;c++)sheet.getCell(r,c).value=null;
  orderWagons(rows).forEach((r,i)=>{if(height!==undefined)sheet.getRow(i+2).height=height;[i+1,r.number,r.type].forEach((v,j)=>{const cell=sheet.getCell(i+2,j+1);cell.style=structuredClone(styles[j]??{});cell.value=v;});});
  sheet.pageSetup.printArea=`A1:C${rows.length+1}`;

  saveBlob(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`${safeFile(rakeName)}_WAGON_DETAILS.xlsx`);
}