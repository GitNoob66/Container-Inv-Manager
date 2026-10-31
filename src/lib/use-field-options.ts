import { useQuery } from "@tanstack/react-query";
import { api, type CustomColumn } from "./api";
import {
  CATEGORIES,
  CONDITIONS,
  CUSTOM_PREFIX,
  MODES,
  OWNERSHIPS,
  RAIL_OWNERSHIP,
  STACKS,
  STATUSES,
} from "./container-fields";
import type { GridColumn } from "@/components/editable-grid";

/** Built-in entry / inventory columns that can be renamed or hidden per centre in Settings. */
export const BUILTIN_COLUMNS: { key: string; label: string; locked?: boolean }[] = [
  { key: "container_no", label: "Container No", locked: true },
  { key: "mode", label: "Mode" },
  { key: "rail_ownership", label: "Rake Own/Other" },
  { key: "rake_name", label: "Rake" },
  { key: "wagon_no", label: "Wagon Number" },
  { key: "stack", label: "Stack" },
  { key: "truck_no", label: "Truck Number" },
  { key: "size", label: "Size" },
  { key: "ctr_type", label: "Type" },
  { key: "dry_subtype", label: "Sub Type" },
  { key: "ownership", label: "Ownership" },
  { key: "lessor", label: "Lessor" },
  { key: "status", label: "Status" },
  { key: "weight", label: "Weight (kg)" },
  { key: "net_weight", label: "Net Weight" },
  { key: "seal_no", label: "Seal Number" },
  { key: "inward_bill_no", label: "Inward Bill No" },
  { key: "condition", label: "Condition" },
  { key: "in_date", label: "In Date" },
  { key: "in_time", label: "In Time" },
  { key: "cargo", label: "Cargo" },
  { key: "category", label: "Category" },
  { key: "account", label: "Party" },
  { key: "yard_position", label: "Yard Position" },
  { key: "destination", label: "Destination" },
  { key: "remarks", label: "Remarks" },
];

export function useColumnConfig(centreId: string) {
  const { data: config = [] } = useQuery({
    queryKey: ["custom-columns", centreId],
    queryFn: () => api.customColumns(centreId),
    enabled: !!centreId,
  });
  const overrides = new Map(config.filter((c) => c.builtin).map((c) => [c.key, c]));
  const custom = config.filter((c) => !c.builtin);
  const label = (key: string, fallback: string) => overrides.get(key)?.label || fallback;
  const hidden = (key: string) => overrides.get(key)?.hidden === true;
  return { config, custom, label, hidden };
}

export function customGridColumns(custom: CustomColumn[]): GridColumn[] {
  return custom
    .filter((c) => !c.hidden)
    .map((c) => ({
      key: `${CUSTOM_PREFIX}${c.key}`,
      label: c.label,
      kind: (c.kind === "select" || c.kind === "number" || c.kind === "date" ? c.kind : "text") as GridColumn["kind"],
      options: c.options,
    }));
}

/** `mode` = the mode chosen above the grid; when given it decides which transport columns show. */
type WagonOptions = { wagons: string[]; mode?: string };

export function useFieldOptions(centreId: string) {
  const { data: rakes = [] } = useQuery({ queryKey: ["rakes"], queryFn: api.rakes });
  const { data: yard = [] } = useQuery({
    queryKey: ["yard", centreId],
    queryFn: () => api.yardPositions(centreId),
    enabled: !!centreId,
  });
  const { data: sizes = [] } = useQuery({ queryKey: ["sizes"], queryFn: api.sizeOptions });
  const { data: types = [] } = useQuery({ queryKey: ["types"], queryFn: api.typeOptions });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", centreId],
    queryFn: () => api.vehicles(centreId),
    enabled: !!centreId,
  });
  const cfg = useColumnConfig(centreId);

  const subtypes = [...new Set(types.flatMap((t) => t.subtypes))];
  const rakeNames = rakes.map((r) => r.rake_name);
  const truckNos = vehicles.map((v) => v.vehicle_no);

  const finish = (cols: (GridColumn & { show?: boolean })[]) =>
    [...cols.filter((c) => c.show !== false && !cfg.hidden(c.key)).map(({ show: _s, ...c }) => ({
      ...c,
      label: cfg.label(c.key, c.label),
    })), ...customGridColumns(cfg.custom)];

  /** Columns for inward / inventory grids; conditional columns appear when any row needs them. */
  const inwardColumns = (rows: Record<string, string>[], w: WagonOptions = { wagons: [] }): GridColumn[] => {
    const anyRail = w.mode ? w.mode === "Rail" : rows.some((r) => r.mode === "Rail");
    const anyRoad = w.mode ? w.mode === "Road" : rows.some((r) => r.mode === "Road");
    return finish([
      { key: "container_no", label: "Container No", width: "10rem" },
      { key: "mode", label: "Mode", kind: "select", options: MODES },
      { key: "rail_ownership", label: "Rake Own/Other", kind: "select", options: RAIL_OWNERSHIP, show: anyRail },
      { key: "rake_name", label: "Rake", kind: "select", options: rakeNames, show: anyRail },
      { key: "wagon_no", label: "Wagon Number", kind: "suggest", options: w.wagons, show: anyRail },
      { key: "stack", label: "Stack", kind: "select", options: STACKS, show: anyRail },
      { key: "truck_no", label: "Truck Number", kind: "suggest", options: truckNos, show: anyRoad },
      { key: "size", label: "Size", kind: "select", options: sizes.map((s) => s.label) },
      { key: "ctr_type", label: "Type", kind: "select", options: types.map((t) => t.label) },
      { key: "dry_subtype", label: "Sub Type", kind: "select", options: subtypes },
      { key: "ownership", label: "Ownership", kind: "select", options: OWNERSHIPS },
      { key: "lessor", label: "Lessor", show: rows.some((r) => r.ownership === "Hired") },
      { key: "status", label: "Status", kind: "select", options: STATUSES },
      { key: "weight", label: "Weight (kg)", kind: "number" },
      { key: "net_weight", label: "Net Weight", kind: "number" },
      { key: "seal_no", label: "Seal Number" },
      { key: "inward_bill_no", label: "Inward Bill No" },
      { key: "condition", label: "Condition", kind: "select", options: CONDITIONS },
      { key: "in_date", label: "In Date", kind: "date" },
      { key: "in_time", label: "In Time", kind: "time" },
      { key: "cargo", label: "Cargo" },
      { key: "category", label: "Category", kind: "select", options: CATEGORIES },
      { key: "account", label: "Party" },
      { key: "yard_position", label: "Yard Position", kind: "select", options: yard.map((y) => y.name) },
    ]);
  };

  const outwardColumns = (rows: Record<string, string>[], w: WagonOptions = { wagons: [] }): GridColumn[] => {
    const anyRail = w.mode ? w.mode === "Rail" : rows.some((r) => r.out_mode === "Rail");
    const anyRoad = w.mode ? w.mode === "Road" : rows.some((r) => r.out_mode === "Road");
    return finish([
      { key: "container_no", label: "Container No", width: "10rem", readOnly: true },
      { key: "out_mode", label: "Out Mode", kind: "select", options: MODES },
      { key: "out_rail_ownership", label: "Rake Own/Other", kind: "select", options: RAIL_OWNERSHIP, show: anyRail },
      { key: "out_rake_name", label: "Rake", kind: "select", options: rakeNames, show: anyRail },
      { key: "out_wagon_no", label: "Wagon Number", kind: "suggest", options: w.wagons, show: anyRail },
      { key: "out_stack", label: "Stack", kind: "select", options: STACKS, show: anyRail },
      { key: "out_truck_no", label: "Truck Number", kind: "suggest", options: truckNos, show: anyRoad },
      { key: "out_date", label: "Out Date", kind: "date" },
      { key: "out_time", label: "Out Time", kind: "time" },
      { key: "destination", label: "Destination" },
      { key: "cargo", label: "Cargo" },
      { key: "remarks", label: "Remarks", width: "12rem" },
      { key: "size", label: "Size", readOnly: true },
      { key: "status", label: "Status", readOnly: true },
      { key: "seal_no", label: "Seal Number", readOnly: true },
      { key: "account", label: "Party", readOnly: true },
      { key: "yard_position", label: "Yard Position", kind: "select", options: yard.map((y) => y.name) },
    ]);
  };

  return { rakes, yard, sizes, types, vehicles, truckNos, cfg, inwardColumns, outwardColumns };
}
