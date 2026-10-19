import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EditableGrid, type GridRow } from "@/components/editable-grid";
import { FlexiUpload } from "@/components/flexi-upload";
import { Button } from "@/components/ui/button";
import { api, type Centre, type Container } from "@/lib/api";
import { containerToRow, CUSTOM_PREFIX, draftToRow, type EntryDraft } from "@/lib/container-fields";
import { logAction } from "@/lib/session";
import { useFieldOptions } from "@/lib/use-field-options";

function toGridRow(c: Container): GridRow {
  return { ...containerToRow(c), __id: c.id };
}

export function InventoryUpdate({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const { inwardColumns, cfg } = useFieldOptions(centre.id);
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
        const { centre_id: _c, ...patch } = draftToRow(r as Partial<EntryDraft> & Record<string, string>, centre.id);
        await api.updateContainer(r.__id, patch);
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
          customColumns={cfg.config}
          onParsed={(result) => {
            let matched = 0;
            setRows((rs) =>
              rs.map((r) => {
                const hit = result.rows.find((p) => p.containerNo === r.container_no);
                if (!hit) return r;
                matched++;
                const custom: Record<string, string> = {};
                for (const [k, v] of Object.entries(hit.custom ?? {})) custom[`${CUSTOM_PREFIX}${k}`] = v;
                const pick = (v: string | undefined, cur: string | undefined) => v ?? cur ?? "";
                return {
                  ...r,
                  ...custom,
                  size: pick(hit.size, r.size),
                  ctr_type: pick(hit.ctrType, r.ctr_type),
                  dry_subtype: pick(hit.drySubtype, r.dry_subtype),
                  status: pick(hit.status, r.status),
                  weight: pick(hit.weight, r.weight),
                  net_weight: pick(hit.netWeight, r.net_weight),
                  seal_no: pick(hit.sealNo, r.seal_no),
                  inward_bill_no: pick(hit.inwardBillNo, r.inward_bill_no),
                  lessor: pick(hit.lessor, r.lessor),
                  ownership: pick(hit.ownership, r.ownership),
                  truck_no: pick(hit.truckNo, r.truck_no),
                  cargo: pick(hit.cargo, r.cargo),
                  account: pick(hit.account, r.account),
                  category: pick(hit.category, r.category),
                  condition: pick(hit.condition, r.condition),
                  yard_position: pick(hit.yardPosition, r.yard_position),
                  in_date: pick(hit.inDate, r.in_date),
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
        columns={inwardColumns(rows)}
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
