import { useRef, useState } from 'react';
import { Check, Copy, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/haulage/ui/button';
import type { Trip } from '@/haulage/lib/rail';
import { createMemo, exportMemo, memoAssets, type Memo } from '@/haulage/lib/release-memo';
import { memoStyle } from '@/haulage/lib/release-memo-style';
import { copyMemo } from '@/haulage/lib/copy-memo';
import { exportMemoDocx } from '@/haulage/lib/export-memo-docx';

function Editable({ value, label, onChange, className = '' }: { value: string; label: string; onChange: (value: string) => void; className?: string }) {
  return <div className={className} contentEditable suppressContentEditableWarning role="textbox" aria-label={label} onBlur={e => onChange(e.currentTarget.innerText)}>{value}</div>;
}
export function ReleaseMaker({ trip, onError }: { trip: Trip | null; onError: (message: string) => void }) {
  const [memo, setMemo] = useState<Memo>(() => createMemo(trip));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFallback,setCopyFallback] = useState(false);
  const copy = async () => { if (!paper.current) return; try { await copyMemo(paper.current); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopyFallback(true); const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(paper.current);selection?.removeAllRanges();selection?.addRange(range); } };
  const downloadWord = async () => { if(!paper.current)return;setBusy(true);try{await exportMemoDocx(paper.current,trip?.rakeName??'CWC');}catch(e){onError(e instanceof Error?e.message:'Could not export DOCX.');}finally{setBusy(false);} };
  const paper = useRef<HTMLDivElement>(null);
  const text = (key: Exclude<keyof Memo, 'rows'>, label: string, className = '') => <Editable value={memo[key]} label={label} className={className} onChange={value => setMemo(current => ({ ...current, [key]: value }))}/>;
  const download = async () => { if (!paper.current) return; setBusy(true); try { await exportMemo(paper.current, trip?.rakeName ?? 'CWC'); } catch (error) { onError(error instanceof Error ? error.message : 'Could not export the release memo.'); } finally { setBusy(false); } };
   return <section aria-label="Release Maker"><style>{memoStyle}</style><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-[29px] font-bold">Release Maker</h1><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setMemo(createMemo(trip))} title="Restore memo from current trip"><RotateCcw size={16}/> Use current rake</Button><Button variant="outline" onClick={() => void copy()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied' : 'Copy formatted memo'}</Button><Button onClick={() => void download()} disabled={busy}><Download size={16}/>{busy ? 'Preparing PDF…' : 'Download PDF'}</Button></div></div>
    <div className="mb-3 flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={()=>void downloadWord()}><Download size={16}/> Download DOCX</Button>{copyFallback&&<span role="status" className="text-sm text-muted-foreground">Clipboard access was blocked. Memo selected: press Ctrl+C to copy, or download DOCX.</span>}</div>
    <div className="overflow-x-auto border border-border bg-muted p-3"><div ref={paper} className="memo-paper mx-auto" aria-label="Editable release memo">
       <div className="memo-letterhead"><img className="memo-header-image" src={memoAssets.header} alt="CWC letterhead"/></div>
      <div className="memo-body"><div className="memo-meta" data-memo-block>{text('reference', 'Memo reference')}<div className="memo-date">{text('dateLabel', 'Date label')}{text('date', 'Memo date')}</div></div><div data-memo-block>{text('recipient', 'Recipient', 'memo-recipient')}</div><div data-memo-block>{text('subject', 'Subject', 'memo-subject')}</div><div data-memo-block>{text('salutation', 'Salutation', 'memo-salutation')}</div><div data-memo-block>{text('introduction', 'Introduction', 'memo-intro')}</div>
        <div className="memo-table">{memo.rows.map((row, index) => <div className="memo-row" data-memo-block key={index}><Editable value={row.label} label={`Row ${index + 1} label`} className="memo-cell" onChange={value => setMemo(current => ({ ...current, rows: current.rows.map((item, i) => i === index ? { ...item, label: value } : item) }))}/><Editable value={row.value} label={row.label} className="memo-cell" onChange={value => setMemo(current => ({ ...current, rows: current.rows.map((item, i) => i === index ? { ...item, value } : item) }))}/></div>)}</div>
        <div data-memo-block>{text('note', 'Note', 'memo-note')}</div><div className="memo-signoff" data-memo-block>{text('closing', 'Closing')}{text('signature', 'Signature designation', 'memo-signature')}</div>
      </div><div className="memo-footer"><img className="memo-footer-reference" src={memoAssets.footerReference} alt="CWC address and service marks"/></div>
    </div></div>
  </section>;
}