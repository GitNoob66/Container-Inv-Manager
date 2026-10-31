import type { Trip } from './rail';
import logo from '@/haulage/assets/release-memo/logo.jpg';
import ribbon from '@/haulage/assets/release-memo/ribbon.jpg';
import certification from '@/haulage/assets/release-memo/certification.jpg';
import footer from '@/haulage/assets/release-memo/footer.jpg';
import location from '@/haulage/assets/release-memo/location.jpg';
import header from '@/haulage/assets/release-memo/header-reference.jpg';
import footerReference from '@/haulage/assets/release-memo/footer-reference.jpg';

export const memoAssets = { logo, ribbon, certification, footer, location, header, footerReference };
export type MemoRow = { label: string; value: string };
export type Memo = { reference: string; dateLabel: string; date: string; recipient: string; subject: string; salutation: string; introduction: string; note: string; closing: string; signature: string; address: string; hindi: string; hindiSubtitle: string; heading: string; subtitle: string; rows: MemoRow[] };
const date = (value: string) => new Date(value).toLocaleDateString('en-GB').replaceAll('/', '.');
export function createMemo(trip: Trip | null): Memo {
  const rake = trip?.rakeName.replace(/^CWC\s+(?!Rake\b)/i, 'CWC Rake ') ?? '';
  const route = trip ? `${rake} ${trip.origin} to ${trip.destination}` : '';
  const wagons = trip ? new Set(trip.containers.map(c => c.wagon)).size + (trip.underframeWagons?.length ?? 0) : 0;
  const upper = trip ? new Set(trip.containers.filter(c => /upper|^ud$/i.test(c.position ?? '')).map(c => c.wagon)).size : 0;
  return {
    reference: 'No. CWC/CFS Mundra/Rail Movement/26-27', dateLabel: 'Date:', date: date(new Date().toISOString()),
    recipient: 'To,\nThe CGS,\nWestern Railway,\nMundra Port', subject: `Subject: Release Memo of ${route} -reg`, salutation: 'Sir,',
    introduction: `Please accept details of the release memo for ${rake} from ${trip?.origin ?? ''} to ${trip?.destination ?? ''} as per given below:`,
    note: 'Note: Checked the rake and found all the wheels of wagons are intact on the rails.', closing: 'Yours faithfully,', signature: 'Manager\nCWC CFS Mundra',
    address: 'CWC (CFS), Mundra, Bharat CFS Zone-1, Mundra Port & SEZ Ltd, Mundra (Kutch)– 370421',
    hindi: 'केन्द्रीय भंडारण निगम', hindiSubtitle: '(नवरत्न सीपीएसई)', heading: 'CENTRAL WAREHOUSING CORPORATION', subtitle: '(A NAVRATNA CPSE)',
    rows: [
      ['CTO Name', 'CWC'], ['Rake No.', trip?.rakeName.replace(/^CWC\s*(?:Rake\s*)?/i,'') ?? ''], ['LINE', ''], ['Ex. station', ''],
      ['Placement date & time', ''], ['Backload station', trip?.destination ?? ''], ['Backload date and time', ''],
      ['Release station', trip?.destination ?? ''], ['Number of Wagons', trip ? String(wagons) : ''], ['Double stack Wagon', trip ? String(upper).padStart(2, '0') : ''],
      ['Category', ''], ['Release date and time', ''], ['Rake Capacity', ''],
      ['Cargo weight', trip?.containers.length ? `${trip.containers.reduce((sum, c) => sum + c.gross, 0).toFixed(3)} MT` : ''],
      ['GST No. Consignee', trip?.destinationGstin ?? ''], ['GST No. Consignor', trip?.bookingGstin ?? ''],
      [trip?.underframeWagons?.length ? 'Underframe Wagons' : '', trip?.underframeWagons?.length ? `${String(trip.underframeWagons.length).padStart(2, '0')} (${trip.underframeWagons.join(', ')})` : ''],
    ].map(([label = '', value = '']) => ({ label, value })),
  };
}

// Use identical measured blocks for the editable preview and PDF. Never split a table row or signature block.
export async function exportMemo(element: HTMLElement, name: string) {
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'px',format:[794,1123],hotfixes:['px_scaling'],compress:true});
  const data=async(src:string)=>{const blob=await(await fetch(src)).blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});};
  const [header,footer]=await Promise.all([data(memoAssets.header),data(memoAssets.footerReference)]);
  const furniture=()=>{pdf.addImage(header,'JPEG',0,0,794,170);pdf.addImage(footer,'JPEG',0,998,794,125);};furniture();
  const rect=element.getBoundingClientRect();let y=170;
  const nodes=Array.from(element.querySelectorAll<HTMLElement>('[data-memo-block]'));
  for(const block of nodes){
    const box=block.getBoundingClientRect();const height=box.height;
    if(y+height>990&&y>170){pdf.addPage();furniture();y=170;}
    // Render editable text as PDF text, not screenshots, preserving copy/search.
    for(const node of Array.from(block.querySelectorAll<HTMLElement>('[contenteditable]'))){
      const bounds=node.getBoundingClientRect(),style=getComputedStyle(node);
      const size=parseFloat(style.fontSize),left=parseFloat(style.paddingLeft)||0,right=parseFloat(style.paddingRight)||0;
      pdf.setFont('times',Number(style.fontWeight)>=600?'bold':'normal');pdf.setFontSize(size*.75);
      const width=bounds.width-left-right-(node.classList.contains('memo-intro')?42:0);
      const lines=(node.closest('.memo-date')?[node.innerText]:pdf.splitTextToSize(node.innerText,width)) as string[];
      const lineHeight=size*(parseFloat(style.lineHeight)/size||1.18);
      let ty=y+bounds.top-box.top+(parseFloat(style.paddingTop)||0)+size*.85;
      for(const line of lines){if(ty>984){pdf.addPage();furniture();ty=184;y=170;}
        const align=style.textAlign==='right'?'right':style.textAlign==='center'?'center':'left';
        const indent=node.classList.contains('memo-intro')&&line===lines[0]?42:0;
        const x=bounds.left-rect.left+left+indent+(align==='right'?width:align==='center'?width/2:0);
        pdf.text(line,x,ty,{align});ty+=lineHeight;
      }
    }
    if(block.classList.contains('memo-row')){const x=box.left-rect.left;pdf.setLineWidth(.7);pdf.line(x,y,x,y+height);pdf.line(x+box.width,y,x+box.width,y+height);pdf.line(x+box.width*.475,y,x+box.width*.475,y+height);
      if(getComputedStyle(block).borderTopWidth!=='0px')pdf.line(x,y,x+box.width,y);
      if(block===element.querySelector('.memo-row:last-child'))pdf.line(x,y+height,x+box.width,y+height);
    }
    y+=height;
  }
  pdf.save(`Release_Memo_${name.replace(/[^\w-]+/g,'_')}.pdf`);
}
