import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import {
  CATEGORIES,
  CONDITIONS,
  MODES,
  OWNERSHIPS,
  RAIL_OWNERSHIP,
  STATUSES,
} from "./container-fields";
import type { GridColumn } from "@/components/editable-grid";

export function useFieldOptions(centreId: string) {
  const { data: rakes = [] } = useQuery({ queryKey: ["rakes"], queryFn: api.rakes });
  const { data: yard = [] } = useQuery({
    queryKey: ["yard", centreId],
    queryFn: () => api.yardPositions(centreId),
    enabled: !!centreId,
  });
  const { data: sizes = [] } = useQuery({ queryKey: ["sizes"], queryFn: api.sizeOptions });
  const { data: types = [] } = useQuery({ queryKey: ["types"], queryFn: api.typeOptions });

  const subtypes = [...new Set(types.flatMap((t) => t.subtypes))];

  const inwardColumns: GridColumn[] = [
    { key: "container_no", label: "Container No", width: "10rem" },
    { key: "mode", label: "Mode", kind: "select", options: MODES },
    { key: "rail_ownership", label: "Rake Own/Other", kind: "select", options: RAIL_OWNERSHIP },
    { key: "rake_name", label: "Rake", kind: "select", options: rakes.map((r) => r.rake_name) },
    { key: "size", label: "Size", kind: "select", options: sizes.map((s) => s.label) },
    { key: "ctr_type", label: "Type", kind: "select", options: types.map((t) => t.label) },
    { key: "dry_subtype", label: "Sub Type", kind: "select", options: subtypes },
    { key: "ownership", label: "Ownership", kind: "select", options: OWNERSHIPS },
    { key: "status", label: "Status", kind: "select", options: STATUSES },
    { key: "weight", label: "Weight (kg)", kind: "number" },
    { key: "condition", label: "Condition", kind: "select", options: CONDITIONS },
    { key: "in_date", label: "In Date", kind: "date" },
    { key: "in_time", label: "In Time", kind: "time" },
    { key: "cargo", label: "Cargo" },
    { key: "category", label: "Category", kind: "select", options: CATEGORIES },
    { key: "account", label: "Account" },
    {
      key: "yard_position",
      label: "Yard Position",
      kind: "select",
      options: yard.map((y) => y.name),
    },
  ];

  const outwardColumns: GridColumn[] = [
    { key: "container_no", label: "Container No", width: "10rem", readOnly: true },
    { key: "out_mode", label: "Out Mode", kind: "select", options: MODES },
    { key: "out_rail_ownership", label: "Rake Own/Other", kind: "select", options: RAIL_OWNERSHIP },
    { key: "out_rake_name", label: "Rake", kind: "select", options: rakes.map((r) => r.rake_name) },
    { key: "out_date", label: "Out Date", kind: "date" },
    { key: "out_time", label: "Out Time", kind: "time" },
    { key: "size", label: "Size", kind: "select", options: sizes.map((s) => s.label), readOnly: true },
    { key: "status", label: "Status", kind: "select", options: STATUSES, readOnly: true },
    { key: "account", label: "Account", readOnly: true },
    { key: "yard_position", label: "Yard Position", kind: "select", options: yard.map((y) => y.name) },
  ];

  return { rakes, yard, sizes, types, inwardColumns, outwardColumns };
}
