import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, RotateCcw, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/haulage/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/haulage/ui/dialog';
import { auditRR, CONTAINER_COLUMNS, exportRRWorkbook, readRRPdf, RR_COLUMNS, sizeCounts, validateRR, type RRRecord } from '@/haulage/lib/rr-analyzer';
import { isBrakeVan } from '@/haulage/lib/wagon-details';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const allRR = RR_COLUMNS.map(c => c.key).filter(k => k !== 'wagonNumbers');
const allContainers = CONTAINER_COLUMNS.map(c => c.key);

export function RRAnalyzer({ onError }: { onError: (s: string) => void }) {
  const [records, setRecords] = useState<RRRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'containers' | 'wagons' | 'audit'>('containers');
  const [picker, setPicker] = useState(false);
  const [rrKeys, setRRKeys] = useState<string[]>(allRR);
  const [cKeys, setCKeys] = useState<string[]>(allContainers);
  const input = useRef<HTMLInputElement>(null);
  const rr = records.find(r => r.id === selected) ?? records[0];
  const audit = useMemo(() => rr ? auditRR(rr) : null, [rr]);
  const issues = useMemo(() => rr ? validateRR(rr) : [], [rr]);
  const [showIssues, setShowIssues] = useState(false);
  const flagged = new Set(issues.map(x => x.ref));

  const load = async (files: FileList | File[] | null) => {
    if (!files?.length) return; setBusy(true);
    const added: RRRecord[] = [];
    for (const file of Array.from(files)) {
      try { const r = await readRRPdf(file); if (records.some(x => x.rrNo === r.rrNo) || added.some(x => x.rrNo === r.rrNo)) onError(`RR ${r.rrNo} is already loaded.`); else added.push(r); }
      catch (e) { onError(e instanceof Error ? e.message : `Could not read ${file.name}.`); }
    }
    if (added.length) { setRecords(cur => [...cur, ...added]); setSelected(added[0]!.id); }
    setBusy(false); if (input.current) input.current.value = '';
  };
  const download = (list: RRRecord[], name: string, rk = rrKeys, ck = cKeys) => void exportRRWorkbook(list, rk, ck, name).catch(e => onError(e instanceof Error ? e.message : 'Export failed.'));
  const toggle = (keys: string[], set: (k: string[]) => void, key: string) => set(keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]);
  const counts = rr ? sizeCounts(rr) : null;
  const containerWagons = rr ? rr.wagons.filter(w => !isBrakeVan(w.type)).length : 0;

  return <section className="space-y-5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void load(e.dataTransfer.files); }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[29px] font-bold">RR Analyzer</h1>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => { setRecords([]); setSelected(''); if (input.current) input.current.value = ''; }}><RotateCcw size={16} /> Reset</Button>
        <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><UploadCloud size={16} />{busy ? 'Reading RR…' : 'Upload eT-RR PDFs'}</Button>
        <Button variant="outline" disabled={!rr} onClick={() => rr && download([rr], `RR_Rake_Summary_${rr.rrNo}_${rr.from}_TO_${rr.to}`, allRR.concat('wagonNumbers'), allContainers)}><FileText size={16} /> Rake summary Excel</Button>
        <Button disabled={!records.length} onClick={() => setPicker(true)}><Download size={16} /> Export {records.length > 1 ? `${records.length} RRs` : 'Excel'}…</Button>
      </div>
    </div>
    <input ref={input} type="file" accept=".pdf" multiple className="hidden" aria-label="Choose RR PDFs" onChange={e => void load(e.target.files)} />

    {!records.length ? <button type="button" onClick={() => input.current?.click()} className="glass-panel flex w-full flex-col items-center gap-2 rounded-3xl border border-dashed p-12 text-muted-foreground"><UploadCloud size={28} /><strong className="text-foreground">Drop one or more eT-RR PDFs here</strong><span className="text-sm">RR details, wagons, containers and freight are read offline.</span></button> : <>
      <div className="flex flex-wrap gap-2">{records.map(r => { const a = auditRR(r); return <div key={r.id} className={`flex items-center gap-1 rounded-2xl border px-3 py-1.5 text-sm ${r.id === rr?.id ? 'border-primary bg-nav-active text-primary' : 'bg-card'}`}>
        <button type="button" className="font-semibold" onClick={() => setSelected(r.id)}>RR {r.rrNo} · {r.from}→{r.to}</button>
        {a.reconciled ? <CheckCircle2 size={14} className="text-success" aria-label="Matched" /> : <AlertTriangle size={14} className="text-destructive" aria-label="Mismatch" />}
        <button type="button" aria-label={`Remove RR ${r.rrNo}`} className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => setRecords(cur => cur.filter(x => x.id !== r.id))}><Trash2 size={13} /></button>
      </div>; })}</div>

      {rr && audit && counts && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[['RR No / Date', `${rr.rrNo}`, rr.rrDate], ['Route', `${rr.from} → ${rr.to}`, `${rr.distance} km`], ['Wagons', `${rr.wagons.length}`, `${containerWagons} container wagons · ${[...new Set(rr.wagons.map(w => w.type))].join(', ')}`],
            ['Containers', rr.loaded ? `${counts.teus} TEUs` : 'Empty rake', rr.loaded ? `${counts.twenty} × 20ft · ${counts.forty} × 40ft` : rr.commodity],
            ['Charged weight', `${rr.chargedWeight} T`, rr.commodity], ['Freight', inr(rr.freight), `DPCN ${inr(rr.dpcn)} · DS ${inr(rr.ds)} · GST ${inr(rr.gst)}`], ['Total freight (RR)', inr(rr.totalFreight), 'As printed on RR'],
            ['Calculated total', inr(audit.total), audit.reconciled ? 'Matches RR' : `Difference ${inr(audit.difference)}`]].map(([l, v, d], i) =>
            <div key={l} className={`glass-panel rounded-2xl border p-4 ${i === 7 ? (audit.reconciled ? 'border-success/50' : 'border-destructive/60') : ''}`}><div className="text-xs font-semibold text-muted-foreground">{l}</div><div className="mt-1 text-xl font-bold">{v}</div><div className="mt-1 truncate text-xs text-muted-foreground" title={d}>{d}</div></div>)}
        </div>
        {(rr.otherCharges ?? []).length > 0 && <div role="status" className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm">
          <strong>This RR includes charges outside the 2018 circular:</strong> {rr.otherCharges.map(c => `${c.code} (${c.name}) ${inr(c.amount)}`).join(' · ')}. Circular-only total would be {inr(audit.standardTotal)}; these charges add {inr(audit.total - audit.standardTotal)} including GST.</div>}
        {issues.length > 0 && <div className="rounded-2xl border border-warning/60 bg-warning/10 p-3 text-sm">
          <button type="button" className="flex w-full items-center gap-2 font-semibold" onClick={() => setShowIssues(v => !v)}><AlertTriangle size={16} /> {issues.length} validation warning{issues.length > 1 ? 's' : ''} — {(['wagon', 'container', 'weight'] as const).map(k => `${issues.filter(i => i.scope === k).length} ${k}`).join(' · ')} <span className="ml-auto text-xs underline">{showIssues ? 'Hide' : 'Review'} before export</span></button>
          {showIssues && <ul className="mt-2 max-h-48 space-y-1 overflow-auto">{issues.map((x, i) => <li key={i}><span className="font-semibold capitalize">{x.scope}</span> · {x.ref}: {x.message}</li>)}</ul>}</div>}
        {!audit.reconciled && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-destructive/60 bg-destructive/10 p-3 text-sm font-semibold text-destructive"><AlertTriangle size={16} /> Calculated haulage {inr(audit.total)} differs from the RR total {inr(rr.totalFreight)} by {inr(audit.difference)}.</div>}

        <div className="flex gap-1 rounded-2xl border bg-card p-1 w-fit">{([['containers', `Freight details (${rr.containers.length})`], ['wagons', `Wagons (${rr.wagons.length})`], ['audit', 'Haulage check']] as const).map(([k, l]) => <Button key={k} size="sm" variant={tab === k ? 'default' : 'ghost'} onClick={() => setTab(k)}>{l}</Button>)}</div>

        <div className="glass-panel overflow-auto rounded-2xl border max-h-[60vh]">
          {tab === 'containers' && (rr.containers.length ? <table className="w-full min-w-[1100px] text-sm"><thead className="sticky top-0 bg-card"><tr>{['#', 'Wagon Type', 'Wagon Number', 'Container Number', 'Size', 'L/E', 'Pos', 'Cmdt', 'Trfc Type', 'Tare(T)', 'Actl Wt(T)', 'Grss Wt(T)', 'RR Freight', 'Calculated'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody>{rr.containers.map((c, i) => <tr key={c.number} className={`border-t ${Math.abs(c.freight - c.calculated) > 0.01 ? 'bg-destructive/10' : flagged.has(c.number) ? 'bg-warning/15' : ''}`} title={issues.filter(x => x.ref === c.number).map(x => x.message).join('; ') || undefined}>{[i + 1, c.wagonType, c.wagonNumber, c.number, c.size, c.le, c.pos, c.cmdt, c.trfc, c.tare ?? '', c.actual ?? '', c.gross, inr(c.freight), inr(c.calculated)].map((v, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{v}</td>)}</tr>)}</tbody></table>
            : <p className="p-6 text-sm text-muted-foreground">No containers on this rake ({rr.commodity}).</p>)}
          {tab === 'wagons' && <table className="w-full text-sm"><thead className="sticky top-0 bg-card"><tr>{['S.NO.', 'WAGON NUMBER', 'TYPE', 'Containers'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody>{rr.wagons.map(w => <tr key={w.number} className={`border-t ${flagged.has(w.number) ? 'bg-warning/15' : ''}`} title={issues.filter(x => x.ref === w.number).map(x => x.message).join('; ') || undefined}><td className="px-3 py-1.5">{w.sn}</td><td className="px-3 py-1.5">{w.number}</td><td className="px-3 py-1.5">{w.type}</td><td className="px-3 py-1.5">{rr.containers.filter(c => c.wagonNumber === w.number).map(c => c.number).join(', ')}</td></tr>)}</tbody></table>}
          {tab === 'audit' && <table className="w-full max-w-3xl text-sm"><thead><tr>{['Item', 'Calculated', 'As per RR', 'Difference'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead><tbody>
            {[[`Container freight (${rr.containers.length} containers @ 2018 circular, ${rr.distance} km)`, audit.containerBase, null],
              [`Empty wagons ${audit.emptyWagons} × ${inr(audit.emptyWagonRate)}`, audit.emptyWagons * audit.emptyWagonRate, null],
              ['Base freight', audit.base, rr.freight], ['DPCN (10%)', audit.dpcn, rr.dpcn], ...(rr.otherCharges ?? []).map(c => [`${c.code} – ${c.name} (as per RR, not in circular)`, c.amount, c.amount]), ['DS (5% of freight + DPCN)', audit.ds, rr.ds], ['GST (5%)', audit.gst, rr.gst], ['Total freight amount', audit.total, rr.totalFreight]]
              .map(([l, c, r]) => <tr key={String(l)} className="border-t"><td className="px-3 py-1.5">{l}</td><td className="px-3 py-1.5">{inr(Number(c))}</td><td className="px-3 py-1.5">{r === null ? '' : inr(Number(r))}</td><td className={`px-3 py-1.5 font-semibold ${r !== null && Math.abs(Number(r) - Number(c)) > 2 ? 'text-destructive' : ''}`}>{r === null ? '' : inr(Math.round((Number(r) - Number(c)) * 100) / 100)}</td></tr>)}
          </tbody></table>}
        </div>
      </>}
    </>}

    <Dialog open={picker} onOpenChange={setPicker}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Choose Excel columns</DialogTitle></DialogHeader>
      <div className="grid gap-5 sm:grid-cols-2">{([['RR Summary sheet', RR_COLUMNS, rrKeys, setRRKeys], ['Container Details sheet', CONTAINER_COLUMNS, cKeys, setCKeys]] as const).map(([title, cols, keys, set]) => <div key={title}>
        <div className="mb-2 flex items-center justify-between"><strong className="text-sm">{title}</strong><span className="flex gap-2 text-xs"><button type="button" className="text-primary" onClick={() => set(cols.map(c => c.key))}>All</button><button type="button" className="text-primary" onClick={() => set([])}>None</button></span></div>
        <div className="grid max-h-80 gap-1.5 overflow-auto">{cols.map(c => <label key={c.key} className="flex items-center gap-2 text-sm"><Checkbox checked={keys.includes(c.key)} onCheckedChange={() => toggle(keys, set, c.key)} />{c.label}</label>)}</div>
      </div>)}</div>
      <DialogFooter><Button variant="outline" onClick={() => setPicker(false)}>Cancel</Button><Button disabled={!rrKeys.length && !cKeys.length} onClick={() => { download(records, records.length === 1 ? `RR_Analysis_${records[0]!.rrNo}` : `RR_Analysis_${records.length}_RRs`); setPicker(false); }}><Download size={16} /> Download Excel</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
