import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EditableGrid, type GridRow } from "@/components/editable-grid";
import { FlexiUpload } from "@/components/flexi-upload";
import { ManualEntryFields } from "@/components/manual-entry";
import { WagonControls } from "@/components/wagon-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Centre } from "@/lib/api";
import { CUSTOM_PREFIX, draftToRow, MODES, emptyDraft, type EntryDraft } from "@/lib/container-fields";
import { parsedToRow } from "@/lib/excel-parse";
import { validateContainerNo } from "@/lib/iso6346";
import { logAction } from "@/lib/session";
import { useFieldOptions } from "@/lib/use-field-options";
import { useWagonSession } from "@/lib/wagon-session";
import { availableWagons, checkWagonLoad, type WagonLoad } from "@/lib/wagons";

function rowLoads(rows: Record<string, string>[], skipId?: string): WagonLoad[] {
  return rows
    .filter((r) => r.__id !== skipId && r.mode === "Rail" && r.wagon_no)
    .map((r) => ({ wagon_no: r.wagon_no!, size: r.size ?? "", stack: r.stack || "Lower" }));
}

export function InwardEntry({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft());
  const [rows, setRows] = useState<GridRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [flexiMode, setFlexiMode] = useState("Road");
  const { inwardColumns, cfg } = useFieldOptions(centre.id);
  const wagons = useWagonSession(`${centre.id}:inward`);

  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }) as EntryDraft);

  const saveManual = async () => {
    const check = validateContainerNo(draft.container_no);
    if (!check.normalized) {
      toast.error("Enter a container number.");
      return;
    }
    if (draft.mode === "Rail" && draft.wagon_no) {
      const err = checkWagonLoad(wagons.loads, draft.wagon_no, draft.size, draft.stack, wagons.doubleStack);
      if (err) {
        toast.error(err);
        return;
      }
    }
    setSaving(true);
    try {
      await api.insertContainers([
        draftToRow(
          { ...draft, container_no: check.normalized, double_stack: wagons.doubleStack ? "true" : "" },
          centre.id,
        ),
      ]);
      if (draft.mode === "Rail" && draft.wagon_no) {
        wagons.addLoads([{ wagon_no: draft.wagon_no, size: draft.size, stack: wagons.doubleStack ? draft.stack : "Lower" }]);
      }
      logAction(centre.id, centre.name, "Inward entry", `${check.normalized} added (manual)`);
      if (check.valid) toast.success(`${check.normalized} added to inventory.`);
      else toast.warning(`${check.normalized} saved, but it failed the ISO 6346 check — it stays highlighted.`);
      // keep the movement details for the next container of the same rake / truck
      setDraft({
        ...emptyDraft(),
        mode: draft.mode,
        rail_ownership: draft.rail_ownership,
        rake_name: draft.rake_name,
        stack: draft.stack,
        in_date: draft.in_date,
      });
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveFlexi = async () => {
    if (!rows.length) return;
    const invalid = rows.filter((r) => !validateContainerNo(r.container_no ?? "").valid);
    setSaving(true);
    try {
      await api.insertContainers(
        rows.map((r) =>
          draftToRow({ ...r, double_stack: wagons.doubleStack ? "true" : "" } as Partial<EntryDraft> & Record<string, string>, centre.id),
        ),
      );
      wagons.addLoads(rowLoads(rows));
      logAction(centre.id, centre.name, "Inward entry", `${rows.length} containers added (flexi)`);
      toast.success(`${rows.length} containers added to inventory.`);
      if (invalid.length) {
        toast.warning(
          `${invalid.length} container number(s) failed the ISO 6346 check and are highlighted in the inventory: ${invalid
            .slice(0, 8)
            .map((r) => r.container_no)
            .join(", ")}`,
          { duration: 10000 },
        );
      }
      setRows([]);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changeCell = (id: string, key: string, value: string) => {
    const current = rows.find((r) => r.__id === id);
    if (!current) return;
    const next = { ...current, [key]: value };
    if (["wagon_no", "stack", "size", "mode"].includes(key) && next.mode === "Rail" && next.wagon_no) {
      const err = checkWagonLoad(
        [...wagons.loads, ...rowLoads(rows, id)],
        next.wagon_no,
        next.size ?? "",
        next.stack || "Lower",
        wagons.doubleStack,
      );
      if (err) {
        toast.error(err);
        return;
      }
    }
    setRows((rs) => rs.map((r) => (r.__id === id ? next : r)));
  };

  const fillColumn = (key: string, value: string) => {
    if (key === "wagon_no" && value) {
      toast.error("Each wagon has a loading limit — choose the wagon per container instead.");
      return;
    }
    setRows((rs) => rs.map((r) => ({ ...r, [key]: value })));
  };

  // selected containers follow the Mode chosen above the list; with nothing selected it applies to all
  const selectRows = (ids: string[]) => {
    const added = new Set(ids.filter((id) => !selected.includes(id)));
    if (added.size) setRows((rs) => rs.map((r) => (added.has(r.__id) ? { ...r, mode: flexiMode } : r)));
    setSelected(ids);
  };
  const changeFlexiMode = (mode: string) => {
    setFlexiMode(mode);
    const sel = new Set(selected);
    setRows((rs) => rs.map((r) => (sel.size === 0 || sel.has(r.__id) ? { ...r, mode } : r)));
  };

  const manualRail = draft.mode === "Rail";
  const flexiRail = rows.some((r) => r.mode === "Rail");
  const openWagons = availableWagons(
    wagons.wagons,
    [...wagons.loads, ...rowLoads(rows)],
    wagons.doubleStack,
  );

  return (
    <Tabs defaultValue="manual" className="space-y-4">
      <TabsList>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        <TabsTrigger value="flexi">Automatic Entry (Flexi)</TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="space-y-4">
        <div className="panel p-5">
          <ManualEntryFields
            centreId={centre.id}
            draft={draft}
            set={set}
            wagonOptions={availableWagons(wagons.wagons, wagons.loads, wagons.doubleStack)}
            doubleStack={wagons.doubleStack}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={saveManual} disabled={saving}>
            <Save className="mr-2 size-4" /> Save entry
          </Button>
          <Button variant="secondary" onClick={() => setDraft(emptyDraft())}>
            <RotateCcw className="mr-2 size-4" /> Reset
          </Button>
          {manualRail ? <WagonControls sessionKey={`${centre.id}:inward`} /> : null}
        </div>
      </TabsContent>

      <TabsContent value="flexi" className="space-y-4">
        {rows.length === 0 ? (
          <FlexiUpload
            customColumns={cfg.config}
            onParsed={(result, fileName) => {
              const base = emptyDraft();
              setRows(result.rows.map((r, i) => ({ __id: `r${i}`, ...parsedToRow(r, base, cfg.custom, CUSTOM_PREFIX) })));
              setSelected([]);
              setFlexiMode(base.mode || "Road");
              logAction(centre.id, centre.name, "Flexi upload", `${fileName}: ${result.rows.length} containers read`);
            }}
          />
        ) : (
          <>
            <div className="panel flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <Select value={flexiMode} onValueChange={changeFlexiMode}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                {selected.length
                  ? `Applies to the ${selected.length} selected container(s).`
                  : "Applies to all containers. Tick containers to set it for those only."}
              </p>
            </div>
            <EditableGrid
              columns={inwardColumns(rows, { wagons: openWagons, mode: flexiMode })}
              rows={rows}
              selectable
              selected={selected}
              onSelectedChange={selectRows}
              validateContainerColumn="container_no"
              onCellChange={changeCell}
              onColumnFill={fillColumn}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={saveFlexi} disabled={saving}>
                <Save className="mr-2 size-4" /> Save {rows.length} containers
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setRows([]);
                  setSelected([]);
                }}
              >
                <RotateCcw className="mr-2 size-4" /> Reset / upload another file
              </Button>
              {flexiRail ? <WagonControls sessionKey={`${centre.id}:inward`} /> : null}
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
