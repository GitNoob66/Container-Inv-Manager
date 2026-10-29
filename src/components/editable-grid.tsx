import { Filter, Search, X } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { validateContainerNo } from "@/lib/iso6346";

export type GridColumn = {
  key: string;
  label: string;
  /** "suggest" = free typing with a suggestion list (wagon / truck numbers). */
  kind?: "text" | "number" | "date" | "time" | "select" | "suggest";
  options?: string[];
  width?: string;
  readOnly?: boolean;
};

export type GridRow = Record<string, string> & { __id: string };

type Props = {
  columns: GridColumn[];
  rows: GridRow[];
  onCellChange: (rowId: string, key: string, value: string) => void;
  onColumnFill: (key: string, value: string) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  validateContainerColumn?: string;
  emptyMessage?: string;
};

const inputType = (kind?: GridColumn["kind"]) =>
  kind === "number" ? "number" : kind === "date" ? "date" : kind === "time" ? "time" : "text";

type RowProps = {
  row: GridRow;
  columns: GridColumn[];
  selectable: boolean;
  checked: boolean;
  editingKey: string | null;
  validateContainerColumn?: string;
  onToggle: (id: string, on: boolean) => void;
  onEdit: (id: string, key: string | null) => void;
  onCommit: (id: string, key: string, value: string) => void;
};

/** One table row. Memoised so ticking a box re-renders only that row. */
const GridRowView = memo(function GridRowView({
  row,
  columns,
  selectable,
  checked,
  editingKey,
  validateContainerColumn,
  onToggle,
  onEdit,
  onCommit,
}: RowProps) {
  const check =
    validateContainerColumn && row[validateContainerColumn]
      ? validateContainerNo(row[validateContainerColumn])
      : null;
  return (
    <tr
      className={cn(
        "border-b border-border/70 hover:bg-muted/50",
        check && !check.valid && "bg-destructive/10",
        checked && "bg-accent/10",
      )}
    >
      {selectable ? (
        <td className="px-2 py-1">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onToggle(row.__id, v === true)}
            aria-label={`Select ${row.container_no ?? "row"}`}
          />
        </td>
      ) : null}
      {columns.map((col) => {
        const isEditing = editingKey === col.key && !col.readOnly;
        const value = row[col.key] ?? "";
        return (
          <td
            key={col.key}
            data-row={row.__id}
            data-col={col.key}
            className="px-2 py-1 align-middle"
            onClick={() => !col.readOnly && !isEditing && onEdit(row.__id, col.key)}
          >
            {isEditing ? (
              col.kind === "select" ? (
                <Select
                  defaultOpen
                  value={value}
                  onOpenChange={(o) => !o && onEdit(row.__id, null)}
                  onValueChange={(v) => {
                    onCommit(row.__id, col.key, v);
                    onEdit(row.__id, null);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(col.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    autoFocus
                    type={inputType(col.kind)}
                    list={col.kind === "suggest" ? `dl-${col.key}` : undefined}
                    defaultValue={value}
                    className={cn("h-7 text-xs", col.kind === "suggest" && "uppercase")}
                    onBlur={(e) => {
                      const v = col.kind === "suggest" ? e.target.value.toUpperCase() : e.target.value;
                      onCommit(row.__id, col.key, v);
                      onEdit(row.__id, null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") onEdit(row.__id, null);
                    }}
                  />
                  {col.kind === "suggest" ? (
                    <datalist id={`dl-${col.key}`}>
                      {(col.options ?? []).map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              )
            ) : (
              <span
                className={cn(
                  "block min-h-6 truncate text-xs",
                  !value && "text-muted-foreground/50",
                  col.key === validateContainerColumn && "num font-medium",
                )}
                title={value}
              >
                {value || "—"}
              </span>
            )}
            {col.key === validateContainerColumn && check && !check.valid ? (
              <span className="block text-[10px] text-destructive">{check.message}</span>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
});

export function EditableGrid({
  columns: columnsProp,
  rows,
  onCellChange,
  onColumnFill,
  selectable = false,
  selected = [],
  onSelectedChange,
  validateContainerColumn,
  emptyMessage = "No rows yet.",
}: Props) {
  // parents rebuild column arrays every render; keep one reference while the content is the same
  const colKey = JSON.stringify(columnsProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => columnsProp, [colKey]);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [fillColumn, setFillColumn] = useState<GridColumn | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [editing, setEditing] = useState<{ rowId: string; key: string } | null>(null);
  const [menuTarget, setMenuTarget] = useState<{ rowId: string; key: string } | null>(null);

  // latest props kept in a ref so the row callbacks stay stable (memo-friendly)
  const latest = useRef({ selected, onSelectedChange, onCellChange });
  latest.current = { selected, onSelectedChange, onCellChange };

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const onToggle = useCallback((id: string, on: boolean) => {
    const { selected: cur, onSelectedChange: cb } = latest.current;
    cb?.(on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id));
  }, []);
  const onEdit = useCallback((rowId: string, key: string | null) => {
    setEditing(key ? { rowId, key } : null);
  }, []);
  const onCommit = useCallback((id: string, key: string, value: string) => {
    latest.current.onCellChange(id, key, value);
  }, []);

  const distinct = (key: string) =>
    [...new Set(rows.map((r) => r[key] ?? ""))].sort((a, b) => a.localeCompare(b));

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.length > 0);
    const q = search.trim().toUpperCase();
    return rows.filter(
      (r) =>
        active.every(([k, vals]) => vals.includes(r[k] ?? "")) &&
        (!q || (r.container_no ?? "").toUpperCase().includes(q)),
    );
  }, [rows, filters, search]);

  // selected containers float to the top (selected rows hidden by search/filter still show)
  const visible = useMemo(() => {
    if (!selectable || selectedSet.size === 0) return filtered;
    const top = rows.filter((r) => selectedSet.has(r.__id));
    const rest = filtered.filter((r) => !selectedSet.has(r.__id));
    return [...top, ...rest];
  }, [rows, filtered, selectable, selectedSet]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selectedSet.has(r.__id));
  const menuCol = menuTarget ? columns.find((c) => c.key === menuTarget.key) : undefined;
  const menuValue = menuTarget ? (rows.find((r) => r.__id === menuTarget.rowId)?.[menuTarget.key] ?? "") : "";

  const commitFill = () => {
    if (!fillColumn) return;
    onColumnFill(fillColumn.key, fillValue);
    setFillColumn(null);
    setFillValue("");
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search container no"
            className="h-7 w-48 pl-7 pr-7 text-xs uppercase"
            aria-label="Search containers"
          />
          {search ? (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-foreground"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <span>
          {filtered.length} of {rows.length} rows
          {selectable && selected.length ? ` · ${selected.length} selected` : ""}
        </span>
        {selectable && selected.length ? (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onSelectedChange?.([])}>
            Clear selection
          </Button>
        ) : null}
        {Object.entries(filters).some(([, v]) => v.length > 0) ? (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setFilters({})}>
            <X className="mr-1 size-3" /> Clear filters
          </Button>
        ) : null}
        <span className="ml-auto hidden sm:inline">
          Click a cell to edit · right-click for column actions
        </span>
      </div>

      <div className="max-h-[62vh] overflow-auto">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <table
              className="w-full border-collapse text-sm"
              onContextMenu={(e) => {
                const td = (e.target as HTMLElement).closest("td[data-col]") as HTMLElement | null;
                if (!td) {
                  e.preventDefault();
                  setMenuTarget(null);
                  return;
                }
                setMenuTarget({ rowId: td.dataset.row!, key: td.dataset.col! });
              }}
            >
              <thead className="sticky top-0 z-10 bg-secondary">
                <tr>
                  {selectable ? (
                    <th className="w-10 border-b border-border px-2 py-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => {
                          const ids = filtered.map((r) => r.__id);
                          onSelectedChange?.(
                            v
                              ? [...new Set([...selected, ...ids])]
                              : selected.filter((id) => !ids.includes(id)),
                          );
                        }}
                        aria-label="Select all"
                      />
                    </th>
                  ) : null}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap border-b border-border px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary-foreground"
                      style={{ minWidth: col.width ?? "8rem" }}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "rounded p-0.5 opacity-50 hover:opacity-100",
                                filters[col.key]?.length && "text-accent opacity-100",
                              )}
                              aria-label={`Filter ${col.label}`}
                            >
                              <Filter className="size-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span className="font-medium">Filter {col.label}</span>
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setFilters((f) => ({ ...f, [col.key]: [] }))}
                              >
                                Reset
                              </button>
                            </div>
                            <div className="max-h-56 space-y-1 overflow-auto">
                              {distinct(col.key).map((v) => {
                                const on = filters[col.key]?.includes(v) ?? false;
                                return (
                                  <label key={v || "(blank)"} className="flex items-center gap-2 text-xs">
                                    <Checkbox
                                      checked={on}
                                      onCheckedChange={(checked) =>
                                        setFilters((f) => {
                                          const cur = f[col.key] ?? [];
                                          return {
                                            ...f,
                                            [col.key]: checked ? [...cur, v] : cur.filter((x) => x !== v),
                                          };
                                        })
                                      }
                                    />
                                    <span className="truncate">{v || "(blank)"}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (selectable ? 1 : 0)}
                      className="px-3 py-10 text-center text-sm text-muted-foreground"
                    >
                      {rows.length ? "No containers match the search." : emptyMessage}
                    </td>
                  </tr>
                ) : null}
                {visible.map((row) => (
                  <GridRowView
                    key={row.__id}
                    row={row}
                    columns={columns}
                    selectable={selectable}
                    checked={selectedSet.has(row.__id)}
                    editingKey={editing?.rowId === row.__id ? editing.key : null}
                    validateContainerColumn={validateContainerColumn}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onCommit={onCommit}
                  />
                ))}
              </tbody>
            </table>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onSelect={() => menuTarget && setEditing(menuTarget)}
              disabled={!menuCol || menuCol.readOnly}
            >
              Edit this cell
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                if (!menuCol) return;
                setFillColumn(menuCol);
                setFillValue(menuValue);
              }}
              disabled={!menuCol || menuCol.readOnly}
            >
              Set whole “{menuCol?.label}” column…
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => menuCol && onColumnFill(menuCol.key, "")}
              disabled={!menuCol || menuCol.readOnly}
            >
              Clear whole column
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => menuCol && setFilters((f) => ({ ...f, [menuCol.key]: [menuValue] }))}
              disabled={!menuCol}
            >
              Filter by this value
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <Dialog open={!!fillColumn} onOpenChange={(o) => !o && setFillColumn(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set “{fillColumn?.label}” for all rows</DialogTitle>
          </DialogHeader>
          {fillColumn?.kind === "select" ? (
            <Select value={fillValue} onValueChange={setFillValue}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a value" />
              </SelectTrigger>
              <SelectContent>
                {(fillColumn.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                autoFocus
                type={inputType(fillColumn?.kind)}
                list={fillColumn?.kind === "suggest" ? "dl-fill" : undefined}
                value={fillValue}
                onChange={(e) =>
                  setFillValue(fillColumn?.kind === "suggest" ? e.target.value.toUpperCase() : e.target.value)
                }
              />
              {fillColumn?.kind === "suggest" ? (
                <datalist id="dl-fill">
                  {(fillColumn.options ?? []).map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              ) : null}
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFillColumn(null)}>
              Cancel
            </Button>
            <Button onClick={commitFill}>Apply to all rows</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
