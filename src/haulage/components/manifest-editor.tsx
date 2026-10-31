import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/haulage/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/haulage/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { changeContainer, newTrip, type Container, type Trip } from '@/haulage/lib/rail';

type Column = { label: string; value: (c: Container) => string; width: string };
const columns: Column[] = [
  { label: 'Wagon', value: c => c.wagon, width: 'w-36' },
  { label: 'Container no.', value: c => c.number, width: 'w-40' },
  { label: 'Size', value: c => `${c.size}`, width: 'w-20' },
  { label: 'ISO Code', value: c => c.isoCode ?? '', width: 'w-28' },
  { label: 'Gross (t)', value: c => `${c.gross}`, width: 'w-24' },
  { label: 'Tare (t)', value: c => `${c.tare}`, width: 'w-24' },
  { label: 'Payload (t)', value: c => Math.max(0, c.gross - c.tare).toFixed(2), width: 'w-24' },
  { label: 'Deck', value: c => c.position ?? 'Lower', width: 'w-24' },
  { label: 'Status', value: c => c.empty ? 'Empty' : 'Loaded', width: 'w-24' },
  { label: 'SMTP number', value: c => c.smtp ?? '', width: 'w-36' },
  { label: 'SMTP Date', value: c => c.smtpDate ?? '', width: 'w-36' },
  { label: 'Shipping Line', value: c => c.line ?? '', width: 'w-36' },
  { label: 'Commodity', value: c => c.commodity, width: 'w-36' },
  { label: 'Destination', value: c => c.destination ?? '', width: 'w-28' },
  { label: 'HSN Code', value: c => c.hsn ?? '', width: 'w-28' },
  { label: 'Type', value: c => c.type ?? '', width: 'w-24' },
];
const blank = (): Container => ({ wagon: '', number: '', size: 20, gross: 0, tare: 2.5, commodity: '', empty: false, position: 'Lower', isoCode: '', smtp: '', smtpDate: '', line: '', destination: '', hsn: '', type: 'EXIM' });

export function ManifestEditor({ trip, onChange, onError, onImport, onDropFile }: { trip: Trip | null; onChange: (trip: Trip) => void; onError: (message: string) => void; onImport: () => void; onDropFile: (file?: File) => void }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null | 'add'>(null);
  const [draft, setDraft] = useState<Container>(blank);
  const rows = useRef<Record<number, HTMLTableRowElement | null>>({});
  const matches = (trip?.containers ?? []).map((container, index) => ({ container, index })).filter(({ container }) => columns.every(column => column.value(container).toLowerCase().includes((filters[column.label] ?? '').trim().toLowerCase())));
  const highlighted = search.trim() ? matches.find(({ container }) => columns.some(column => column.value(container).toLowerCase().includes(search.trim().toLowerCase()))) : undefined;
  useEffect(() => { if (highlighted) rows.current[highlighted.index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }, [highlighted?.index, search]);
  const open = (index: number | 'add') => { setEditing(index); setDraft(index === 'add' ? blank() : { ...trip?.containers[index] ?? blank() }); };
  const remove = (index: number) => { if (!trip) return; onChange(changeContainer(trip, index)); setEditing(null); };
  const save = () => {
    if (!draft.wagon.trim() || !draft.number.trim() || !Number.isFinite(draft.gross) || draft.gross < 0 || !Number.isFinite(draft.tare) || draft.tare < 0 || draft.gross < draft.tare) { onError('Enter a wagon, container number, and valid gross/tare weights.'); return; }
    try { onChange(changeContainer(trip ?? newTrip(), editing === 'add' ? null : editing, { ...draft, wagon: draft.wagon.trim(), number: draft.number.trim() })); setEditing(null); }
    catch (error) { onError(error instanceof Error ? error.message : 'Could not save container.'); }
  };
  const field = (label: string, key: keyof Container, type = 'text') => <label className="min-w-0 text-xs font-semibold text-muted-foreground">{label}<Input aria-label={label} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} className="mt-1 h-9 text-foreground" value={String(draft[key] ?? '')} onChange={e => setDraft(previous => ({ ...previous, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}/></label>;
  return <section className="min-w-0" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); onDropFile(event.dataTransfer.files[0]); }}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-bold">Train manifest</h2><p className="text-xs text-muted-foreground">{trip ? `${trip.containers.length} containers · ${trip.fileName || 'Manual rake'}` : 'Import a report or add a container'}</p></div><Button size="sm" variant="outline" onClick={() => open('add')}><Plus size={15}/> Add container</Button></div>
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-start gap-2 border-b border-border p-2"><div className="relative min-w-0 flex-[1_1_250px]"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Search container" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find container, wagon or any detail" className="h-9 w-full pl-9 text-xs"/></div>{highlighted && <Badge variant="secondary" className="max-w-full self-center truncate">{highlighted.container.number} · {highlighted.container.wagon} · {highlighted.container.size} ft · {highlighted.container.empty ? 'Empty' : 'Loaded'}</Badge>}<span className="self-center text-xs text-muted-foreground">{matches.length} shown</span></div>
      {!trip?.containers.length && <div className="flex min-h-20 items-center justify-center gap-3 border-b border-border p-3 text-sm text-muted-foreground">No containers yet. <Button variant="outline" size="sm" onClick={onImport}>Import report</Button></div>}
      <div className="max-h-[420px] overflow-auto"><table className="w-max min-w-full table-fixed text-left text-xs"><thead className="sticky top-0 z-10 bg-table-head"><tr>{columns.map(column => <th scope="col" key={column.label} className={`${column.width} border-r border-border px-2 py-2 align-top font-semibold text-muted-foreground`}><span className="block truncate" title={column.label}>{column.label}</span><Input aria-label={`Filter ${column.label}`} placeholder="Filter…" value={filters[column.label] ?? ''} onChange={e => setFilters(previous => ({ ...previous, [column.label]: e.target.value }))} className="mt-1 h-7 w-full min-w-0 bg-card px-2 text-xs font-normal text-foreground"/></th>)}<th className="sticky right-0 w-20 bg-table-head px-2 py-2">Actions</th></tr></thead><tbody>{matches.map(({ container, index }) => <ContextMenu key={index}><ContextMenuTrigger asChild><tr ref={node => { rows.current[index] = node; }} className={`border-t border-border/70 ${highlighted?.index === index ? 'bg-highlight-soft ring-1 ring-inset ring-highlight' : 'hover:bg-muted/60'}`}>{columns.map(column => <td key={column.label} className={`${column.width} truncate px-2 py-2.5`} title={column.value(container)}>{column.value(container) || '—'}</td>)}<td className="sticky right-0 bg-card px-1"><div className="flex"><Button variant="ghost" size="icon" className="size-7" title="Edit container" aria-label={`Edit ${container.number}`} onClick={() => open(index)}><Pencil size={14}/></Button><Button variant="ghost" size="icon" className="size-7 text-destructive" title="Delete container" aria-label={`Delete ${container.number}`} onClick={() => remove(index)}><Trash2 size={14}/></Button></div></td></tr></ContextMenuTrigger><ContextMenuContent><ContextMenuItem onSelect={() => open(index)}><Pencil size={14} className="mr-2"/> Edit</ContextMenuItem><ContextMenuItem className="text-destructive" onSelect={() => remove(index)}><Trash2 size={14} className="mr-2"/> Delete</ContextMenuItem></ContextMenuContent></ContextMenu>)}</tbody></table>{trip && matches.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">No containers match these filters.</p>}</div>
    </div>
    <Dialog open={editing !== null} onOpenChange={isOpen => { if (!isOpen) setEditing(null); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing === 'add' ? 'Add container' : 'Edit container'}</DialogTitle></DialogHeader><form onSubmit={e => { e.preventDefault(); save(); }} className="grid gap-3 sm:grid-cols-3">{field('Wagon', 'wagon')}{field('Container number', 'number')}<label className="text-xs font-semibold text-muted-foreground">Size<select aria-label="Size" className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-foreground" value={draft.size} onChange={e => setDraft(previous => ({ ...previous, size: Number(e.target.value) as 20 | 40 }))}><option value="20">20 ft</option><option value="40">40 ft</option></select></label>{field('Gross (t)', 'gross', 'number')}{field('Tare (t)', 'tare', 'number')}<label className="text-xs font-semibold text-muted-foreground">Deck<select aria-label="Deck" className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-foreground" value={draft.position ?? 'Lower'} onChange={e => setDraft(previous => ({ ...previous, position: e.target.value }))}><option>Lower</option><option>Upper</option></select></label><label className="text-xs font-semibold text-muted-foreground">Status<select aria-label="Status" className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-foreground" value={draft.empty ? 'Empty' : 'Loaded'} onChange={e => setDraft(previous => ({ ...previous, empty: e.target.value === 'Empty', status: e.target.value === 'Empty' ? 'EMPTY' : 'FCL' }))}><option>Loaded</option><option>Empty</option></select></label>{field('ISO Code', 'isoCode')}{field('SMTP number', 'smtp')}{field('SMTP Date', 'smtpDate')}{field('Shipping Line', 'line')}{field('Commodity', 'commodity')}{field('Destination', 'destination')}{field('HSN Code', 'hsn')}{field('Type', 'type')}<DialogFooter className="sm:col-span-3"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save container</Button></DialogFooter></form></DialogContent></Dialog>
  </section>;
}