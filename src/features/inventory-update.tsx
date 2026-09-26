import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EditableGrid, type GridRow } from "@/components/editable-grid";
import { FlexiUpload } from "@/components/flexi-upload";
import { Button } from "@/components/ui/button";
import { api, type Centre, type Container } from "@/lib/api";
import { logAction } from "@/lib/session";
import { useFieldOptions } from "@/lib/use-field-options";

function toGridRow(c: Container): GridRow {
  return {
    __id: c.id,
    container_no: c.container_no,
    mode: c.mode ?? "",
    rail_ownership: c.rail_ownership ?? "",
    rake_name: c.rake_name ?? "",
    size: c.size ?? "",
    ctr_type: c.ctr_type ?? "",
    dry_subtype: c.dry_subtype ?? "",
    ownership: c.ownership ?? "",
    status: c.status ?? "",
    weight: c.weight != null ? String(c.weight) : "",
    condition: c.condition ?? "",
    in_date: c.in_date ?? "",
    in_time: c.in_time ?? "",
    cargo: c.cargo ?? "",
    category: c.category ?? "",
    account: c.account ?? "",
    yard_position: c.yard_position ?? "",
  };
}

export function InventoryUpdate({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const { inwardColumns } = useFieldOptions(centre.id);
  const { data: containers = [] } = useQuery({
    queryKey: ["containers", centre.id],
    queryFn: () => api.containers(centre.id),
  });
  const [rows, setRows] = useState<GridRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const original = useMemo(() => containers.map(toGridRow), [containers]);
  useEffect(() => {
    setRows(original);
    setDirty(new Set());
  }, [original]);

  const change = (id: string, key: string, value: string) => {
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, [key]: value } : r)));
    setDirty((d) => new Set(d).add(id));
  };

  const fill = (key: string, value: string) => {
    setRows((rs) => rs.map((r) => ({ ...r, [key]: value })));
    setDirty(new Set(rows.map((r) => r.__id)));
  };

  const save = async () => {
    const changed = rows.filter((r) => dirty.has(r.__id));
    if (!changed.length) {
      toast.info("Nothing has changed.");
      return;
    }
    try {
      for (const r of changed) {
        await api.updateContainer(r.__id, {
          container_no: r.container_no.toUpperCase(),
          mode: r.mode || null,
          rail_ownership: r.rail_ownership || null,
          rake_name: r.rake_name || null,
          size: r.size || null,
          ctr_type: r.ctr_type || null,
          dry_subtype: r.dry_subtype || null,
          ownership: r.ownership || null,
          status: r.status || null,
          weight: r.weight ? Number(r.weight) : null,
          condition: r.condition || null,
          in_date: r.in_date || null,
          in_time: r.in_time || null,
          cargo: r.cargo || null,
          category: r.category || null,
          account: r.account || null,
          yard_position: r.yard_position || null,
        });
      }
      logAction(centre.id, centre.name, "Inventory update", `${changed.length} containers updated`);
      toast.success(`${changed.length} container(s) updated.`);
      setDirty(new Set());
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeSelected = async () => {
    if (!selected.length) return;
    try {
      await api.deleteContainers(selected);
      logAction(centre.id, centre.name, "Containers deleted", `${selected.length} removed`);
      toast.success(`${selected.length} container(s) deleted.`);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={dirty.size === 0}>
          <Save className="mr-2 size-4" /> Save {dirty.size || ""} change{dirty.size === 1 ? "" : "s"}
        </Button>
        <Button variant="secondary" onClick={() => setShowUpload((s) => !s)}>
          <Upload className="mr-2 size-4" /> Update from Excel
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setRows(original);
            setDirty(new Set());
          }}
        >
          Reset
        </Button>
        <Button variant="destructive" onClick={removeSelected} disabled={!selected.length}>
          <Trash2 className="mr-2 size-4" /> Delete selected
        </Button>
      </div>

      {showUpload ? (
        <FlexiUpload
          onParsed={(result) => {
            let matched = 0;
            setRows((rs) =>
              rs.map((r) => {
                const hit = result.rows.find((p) => p.containerNo === r.container_no);
                if (!hit) return r;
                matched++;
                return {
                  ...r,
                  size: hit.size ?? r.size,
                  ctr_type: hit.ctrType ?? r.ctr_type,
                  dry_subtype: hit.drySubtype ?? r.dry_subtype,
                  status: hit.status ?? r.status,
                  weight: hit.weight ?? r.weight,
                  cargo: hit.cargo ?? r.cargo,
                  account: hit.account ?? r.account,
                  category: hit.category ?? r.category,
                  condition: hit.condition ?? r.condition,
                  yard_position: hit.yardPosition ?? r.yard_position,
                };
              }),
            );
            setDirty(
              new Set(
                rows
                  .filter((r) => result.rows.some((p) => p.containerNo === r.container_no))
                  .map((r) => r.__id),
              ),
            );
            setShowUpload(false);
            toast.success(`${matched} container(s) matched in this centre's inventory.`);
          }}
        />
      ) : null}

      <EditableGrid
        columns={inwardColumns}
        rows={rows}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        validateContainerColumn="container_no"
        onCellChange={change}
        onColumnFill={fill}
        emptyMessage="No containers in this centre yet. Add them from Inward Entry."
      />
    </div>
  );
}
