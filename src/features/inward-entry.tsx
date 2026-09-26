import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EditableGrid, type GridRow } from "@/components/editable-grid";
import { FlexiUpload } from "@/components/flexi-upload";
import { ManualEntryFields } from "@/components/manual-entry";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Centre } from "@/lib/api";
import { draftToRow, emptyDraft, type EntryDraft } from "@/lib/container-fields";
import { validateContainerNo } from "@/lib/iso6346";
import { logAction } from "@/lib/session";
import { useFieldOptions } from "@/lib/use-field-options";

export function InwardEntry({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft());
  const [rows, setRows] = useState<GridRow[]>([]);
  const [saving, setSaving] = useState(false);
  const { inwardColumns } = useFieldOptions(centre.id);

  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const saveManual = async () => {
    const check = validateContainerNo(draft.container_no);
    if (!check.valid) {
      toast.error(`Container number is wrong — ${check.message}`);
      return;
    }
    setSaving(true);
    try {
      await api.insertContainers([draftToRow({ ...draft, container_no: check.normalized }, centre.id)]);
      logAction(centre.id, centre.name, "Inward entry", `${check.normalized} added (manual)`);
      toast.success(`${check.normalized} added to inventory.`);
      setDraft(emptyDraft());
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveFlexi = async () => {
    const invalid = rows.filter((r) => !validateContainerNo(r.container_no).valid);
    if (invalid.length) {
      toast.error(
        `Fix these container numbers first: ${invalid.map((r) => r.container_no).join(", ")}`,
      );
      return;
    }
    if (!rows.length) return;
    setSaving(true);
    try {
      await api.insertContainers(
        rows.map((r) => draftToRow(r as unknown as Partial<EntryDraft>, centre.id)),
      );
      logAction(centre.id, centre.name, "Inward entry", `${rows.length} containers added (flexi)`);
      toast.success(`${rows.length} containers added to inventory.`);
      setRows([]);
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tabs defaultValue="manual" className="space-y-4">
      <TabsList>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        <TabsTrigger value="flexi">Automatic Entry (Flexi)</TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="space-y-4">
        <div className="panel p-5">
          <ManualEntryFields centreId={centre.id} draft={draft} set={set} />
        </div>
        <div className="flex gap-2">
          <Button onClick={saveManual} disabled={saving}>
            <Save className="mr-2 size-4" /> Save entry
          </Button>
          <Button variant="secondary" onClick={() => setDraft(emptyDraft())}>
            <RotateCcw className="mr-2 size-4" /> Reset
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="flexi" className="space-y-4">
        {rows.length === 0 ? (
          <FlexiUpload
            onParsed={(result, fileName) => {
              const base = emptyDraft();
              setRows(
                result.rows.map((r, i) => ({
                  __id: `r${i}`,
                  container_no: r.containerNo,
                  mode: base.mode,
                  rail_ownership: "",
                  rake_name: "",
                  size: r.size ?? base.size,
                  ctr_type: r.ctrType ?? base.ctr_type,
                  dry_subtype: r.drySubtype ?? "",
                  ownership: r.ownership ?? base.ownership,
                  status: r.status ?? base.status,
                  weight: r.weight ?? "",
                  condition: r.condition ?? base.condition,
                  in_date: base.in_date,
                  in_time: base.in_time,
                  cargo: r.cargo ?? "",
                  category: r.category ?? base.category,
                  account: r.account ?? "",
                  yard_position: r.yardPosition ?? "",
                })),
              );
              logAction(
                centre.id,
                centre.name,
                "Flexi upload",
                `${fileName}: ${result.rows.length} containers read`,
              );
            }}
          />
        ) : (
          <>
            <EditableGrid
              columns={inwardColumns}
              rows={rows}
              validateContainerColumn="container_no"
              onCellChange={(id, key, value) =>
                setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, [key]: value } : r)))
              }
              onColumnFill={(key, value) => setRows((rs) => rs.map((r) => ({ ...r, [key]: value })))}
            />
            <div className="flex gap-2">
              <Button onClick={saveFlexi} disabled={saving}>
                <Save className="mr-2 size-4" /> Save {rows.length} containers
              </Button>
              <Button variant="secondary" onClick={() => setRows([])}>
                <RotateCcw className="mr-2 size-4" /> Reset / upload another file
              </Button>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
