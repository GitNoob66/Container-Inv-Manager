import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
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
  kind?: "text" | "number" | "date" | "time" | "select";
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

export function EditableGrid({
  columns,
  rows,
  onCellChange,
  onColumnFill,
  selectable,
  selected = [],
  onSelectedChange,
  validateContainerColumn,
  emptyMessage = "No rows yet.",
}: Props) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [fillColumn, setFillColumn] = useState<GridColumn | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [editing, setEditing] = useState<{ rowId: string; key: string } | null>(null);

  const distinct = (key: string) =>
    [...new Set(rows.map((r) => r[key] ?? ""))].sort((a, b) => a.localeCompare(b));

  const visible = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.length > 0);
    if (!active.length) return rows;
    return rows.filter((r) => active.every(([k, vals]) => vals.includes(r[k] ?? "")));
  }, [rows, filters]);

  const allSelected = visible.length > 0 && visible.every((r) => selected.includes(r.__id));

  const commitFill = () => {
    if (!fillColumn) return;
    onColumnFill(fillColumn.key, fillValue);
    setFillColumn(null);
    setFillValue("");
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          {visible.length} of {rows.length} rows
        </span>
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
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-secondary">
            <tr>
              {selectable ? (
                <th className="w-10 border-b border-border px-2 py-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) =>
                      onSelectedChange?.(v ? visible.map((r) => r.__id) : [])
                    }
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
                                        [col.key]: checked
                                          ? [...cur, v]
                                          : cur.filter((x) => x !== v),
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
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {visible.map((row) => {
              const check =
                validateContainerColumn && row[validateContainerColumn]
                  ? validateContainerNo(row[validateContainerColumn])
                  : null;
              return (
                <tr
                  key={row.__id}
                  className={cn(
                    "border-b border-border/70 hover:bg-muted/50",
                    check && !check.valid && "bg-destructive/10",
                  )}
                >
                  {selectable ? (
                    <td className="px-2 py-1">
                      <Checkbox
                        checked={selected.includes(row.__id)}
                        onCheckedChange={(v) =>
                          onSelectedChange?.(
                            v
                              ? [...selected, row.__id]
                              : selected.filter((id) => id !== row.__id),
                          )
                        }
                        aria-label="Select row"
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => {
                    const isEditing =
                      editing?.rowId === row.__id && editing.key === col.key && !col.readOnly;
                    const value = row[col.key] ?? "";
                    return (
                      <ContextMenu key={col.key}>
                        <ContextMenuTrigger asChild>
                          <td
                            className="px-2 py-1 align-middle"
                            onClick={() => !col.readOnly && setEditing({ rowId: row.__id, key: col.key })}
                          >
                            {isEditing ? (
                              col.kind === "select" ? (
                                <Select
                                  defaultOpen
                                  value={value}
                                  onValueChange={(v) => {
                                    onCellChange(row.__id, col.key, v);
                                    setEditing(null);
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
                                <Input
                                  autoFocus
                                  type={
                                    col.kind === "number"
                                      ? "number"
                                      : col.kind === "date"
                                        ? "date"
                                        : col.kind === "time"
                                          ? "time"
                                          : "text"
                                  }
                                  defaultValue={value}
                                  className="h-7 text-xs"
                                  onBlur={(e) => {
                                    onCellChange(row.__id, col.key, e.target.value);
                                    setEditing(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      onCellChange(row.__id, col.key, e.currentTarget.value);
                                      setEditing(null);
                                    }
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                />
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
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onSelect={() => setEditing({ rowId: row.__id, key: col.key })}
                            disabled={col.readOnly}
                          >
                            Edit this cell
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              setFillColumn(col);
                              setFillValue(value);
                            }}
                            disabled={col.readOnly}
                          >
                            Set whole “{col.label}” column…
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => onColumnFill(col.key, "")}
                            disabled={col.readOnly}
                          >
                            Clear whole column
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onSelect={() => setFilters((f) => ({ ...f, [col.key]: [value] }))}
                          >
                            Filter by this value
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
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
            <Input
              autoFocus
              type={
                fillColumn?.kind === "number"
                  ? "number"
                  : fillColumn?.kind === "date"
                    ? "date"
                    : fillColumn?.kind === "time"
                      ? "time"
                      : "text"
              }
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
            />
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
