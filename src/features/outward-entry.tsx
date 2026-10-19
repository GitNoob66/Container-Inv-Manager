import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EditableGrid, type GridRow } from "@/components/editable-grid";
import { FlexiUpload } from "@/components/flexi-upload";
import { WagonControls } from "@/components/wagon-controls";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type Centre, type Container } from "@/lib/api";
import { containerToRow, MODES, outwardPatch, RAIL_OWNERSHIP } from "@/lib/container-fields";
import { logAction } from "@/lib/session";
import { useFieldOptions } from "@/lib/use-field-options";
import { useWagonSession } from "@/lib/wagon-session";
import { availableWagons, checkWagonLoad, type WagonLoad } from "@/lib/wagons";

function toRow(c: Container, now: { date: string; time: string }): GridRow {
  return {
    ...containerToRow(c),
    __id: c.id,
    out_mode: "Road",
    out_rail_ownership: "",
    out_rake_name: "",
    out_wagon_no: "",
    out_stack: "Lower",
    out_truck_no: "",
    out_date: now.date,
    out_time: now.time,
    destination: "",
    remarks: "",
  };
}

function rowLoads(rows: Record<string, string>[], skipId?: string): WagonLoad[] {
  return rows
    .filter((r) => r.__id !== skipId && r.out_mode === "Rail" && r.out_wagon_no)
    .map((r) => ({ wagon_no: r.out_wagon_no!, size: r.size ?? "", stack: r.out_stack || "Lower" }));
}

function BulkField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function OutwardEntry({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const { outwardColumns, rakes, truckNos, cfg } = useFieldOptions(centre.id);
  const sessionKey = `${centre.id}:outward`;
  const wagons = useWagonSession(sessionKey);
  const { data: containers = [] } = useQuery({
    queryKey: ["containers", centre.id],
    queryFn: () => api.containers(centre.id),
  });

  const nowParts = useMemo(() => {
    const n = new Date();
    const p = (x: number) => String(x).padStart(2, "0");
    return { date: `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`, time: n.toTimeString().slice(0, 5) };
  }, []);

  const [rows, setRows] = useState<GridRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState({
    out_mode: "Road",
    out_rail_ownership: "",
    out_rake_name: "",
    out_truck_no: "",
    out_date: nowParts.date,
    out_time: nowParts.time,
    destination: "",
    remarks: "",
  });

  const base = useMemo(() => containers.map((c) => toRow(c, nowParts)), [containers, nowParts]);
  useEffect(() => setRows(base), [base]);

  const dispatch = async (ids: string[]) => {
    if (!ids.length) {
      toast.error("Select at least one container.");
      return;
    }
    const chosen = rows.filter((r) => ids.includes(r.__id));
    // re-check the wagon rules across everything being moved out together
    const loads: WagonLoad[] = [...wagons.loads];
    for (const r of chosen) {
      if (r.out_mode !== "Rail" || !r.out_wagon_no) continue;
      const err = checkWagonLoad(loads, r.out_wagon_no, r.size ?? "", r.out_stack || "Lower", wagons.doubleStack);
      if (err) {
        toast.error(`${r.container_no}: ${err}`);
        return;
      }
      loads.push({ wagon_no: r.out_wagon_no, size: r.size ?? "", stack: r.out_stack || "Lower" });
    }
    try {
      for (const r of chosen) {
        await api.updateContainer(
          r.__id,
          outwardPatch({ ...r, out_double_stack: wagons.doubleStack ? "true" : "" }, r),
        );
      }
      wagons.addLoads(rowLoads(chosen));
      logAction(centre.id, centre.name, "Outward entry", `${ids.length} containers dispatched: ${chosen.map((r) => r.container_no).join(", ")}`);
      toast.success(`${ids.length} container(s) moved out.`);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ["containers"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyBulk = () => {
    setRows((rs) =>
      rs.map((r) => (selected.length === 0 || selected.includes(r.__id) ? { ...r, ...bulk } : r)),
    );
    toast.success(selected.length ? "Out details applied to the selected containers." : "Out details applied to all rows.");
  };

  const changeCell = (id: string, key: string, value: string) => {
    const current = rows.find((r) => r.__id === id);
    if (!current) return;
    const next = { ...current, [key]: value };
    if (["out_wagon_no", "out_stack", "out_mode"].includes(key) && next.out_mode === "Rail" && next.out_wagon_no) {
      const err = checkWagonLoad(
        [...wagons.loads, ...rowLoads(rows, id)],
        next.out_wagon_no,
        next.size ?? "",
        next.out_stack || "Lower",
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
    if (key === "out_wagon_no" && value) {
      toast.error("Each wagon has a loading limit — choose the wagon per container instead.");
      return;
    }
    setRows((rs) => rs.map((r) => ({ ...r, [key]: value })));
  };

  const openWagons = availableWagons(wagons.wagons, [...wagons.loads, ...rowLoads(rows)], wagons.doubleStack);
  const columns = outwardColumns(rows, { wagons: openWagons });
  const anyRail = bulk.out_mode === "Rail" || rows.some((r) => r.out_mode === "Rail");
  const listId = `out-trucks-${centre.id}`;

  const grid = (empty: string) => (
    <EditableGrid
      columns={columns}
      rows={rows}
      selectable
      selected={selected}
      onSelectedChange={setSelected}
      validateContainerColumn="container_no"
      onCellChange={changeCell}
      onColumnFill={fillColumn}
      emptyMessage={empty}
    />
  );

  const moveButton = (
    <Button onClick={() => dispatch(selected)} disabled={!selected.length}>
      <LogOut className="mr-2 size-4" /> Move out {selected.length || ""} container
      {selected.length === 1 ? "" : "s"}
    </Button>
  );

  return (
    <Tabs defaultValue="manual" className="space-y-4">
      <TabsList>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        <TabsTrigger value="flexi">Automatic Entry (Flexi)</TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="space-y-4">
        <div className="panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <BulkField label="Out Mode">
            <Select value={bulk.out_mode} onValueChange={(v) => setBulk((b) => ({ ...b, out_mode: v }))}>
              <SelectTrigger>
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
          </BulkField>
          {bulk.out_mode === "Road" && !cfg.hidden("truck_no") ? (
            <BulkField label={cfg.label("truck_no", "Truck Number")}>
              <Input
                list={listId}
                className="num uppercase"
                value={bulk.out_truck_no}
                onChange={(e) => setBulk((b) => ({ ...b, out_truck_no: e.target.value.toUpperCase() }))}
              />
              <datalist id={listId}>
                {truckNos.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </BulkField>
          ) : null}
          {bulk.out_mode === "Rail" ? (
            <BulkField label="Rake Own / Other">
              <Select
                value={bulk.out_rail_ownership || undefined}
                onValueChange={(v) => setBulk((b) => ({ ...b, out_rail_ownership: v, out_rake_name: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {RAIL_OWNERSHIP.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BulkField>
          ) : null}
          {bulk.out_mode === "Rail" && bulk.out_rail_ownership === "Own" ? (
            <BulkField label="Rake">
              <Select
                value={bulk.out_rake_name || undefined}
                onValueChange={(v) => setBulk((b) => ({ ...b, out_rake_name: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rake" />
                </SelectTrigger>
                <SelectContent>
                  {rakes.map((r) => (
                    <SelectItem key={r.id} value={r.rake_name}>
                      {r.rake_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BulkField>
          ) : null}
          {bulk.out_mode === "Rail" && bulk.out_rail_ownership === "Other" ? (
            <BulkField label="Rake Name">
              <Input
                value={bulk.out_rake_name}
                onChange={(e) => setBulk((b) => ({ ...b, out_rake_name: e.target.value }))}
              />
            </BulkField>
          ) : null}
          <BulkField label="Out Date">
            <Input type="date" value={bulk.out_date} onChange={(e) => setBulk((b) => ({ ...b, out_date: e.target.value }))} />
          </BulkField>
          <BulkField label="Out Time (24h)">
            <Input type="time" value={bulk.out_time} onChange={(e) => setBulk((b) => ({ ...b, out_time: e.target.value }))} />
          </BulkField>
          <BulkField label={cfg.label("destination", "Destination")}>
            <Input value={bulk.destination} onChange={(e) => setBulk((b) => ({ ...b, destination: e.target.value }))} />
          </BulkField>
          <BulkField label={cfg.label("remarks", "Remarks")}>
            <Input value={bulk.remarks} onChange={(e) => setBulk((b) => ({ ...b, remarks: e.target.value }))} />
          </BulkField>
          <div className="flex items-end">
            <Button variant="secondary" onClick={applyBulk} className="w-full">
              Apply to selected
            </Button>
          </div>
        </div>

        {grid("No containers available for outward movement.")}

        <div className="flex flex-wrap items-center gap-2">
          {moveButton}
          {anyRail ? <WagonControls sessionKey={sessionKey} /> : null}
        </div>
      </TabsContent>

      <TabsContent value="flexi" className="space-y-4">
        <FlexiUpload
          customColumns={cfg.config}
          onParsed={(result) => {
            const matched = base
              .filter((r) => result.rows.some((p) => p.containerNo === r.container_no))
              .map((r) => {
                const p = result.rows.find((x) => x.containerNo === r.container_no);
                return {
                  ...r,
                  ...(p?.outDate ? { out_date: p.outDate } : {}),
                  ...(p?.destination ? { destination: p.destination } : {}),
                  ...(p?.truckNo ? { out_truck_no: p.truckNo } : {}),
                };
              });
            const missing = result.rows.filter((p) => !base.some((r) => r.container_no === p.containerNo));
            setRows(matched);
            setSelected(matched.map((r) => r.__id));
            if (missing.length) {
              toast.warning(
                `${missing.length} container(s) from the file are not in this centre's inventory: ${missing
                  .slice(0, 6)
                  .map((m) => m.containerNo)
                  .join(", ")}${missing.length > 6 ? "…" : ""}`,
                { duration: 9000 },
              );
            }
            toast.success(`${matched.length} container(s) ready for outward entry.`);
          }}
        />
        {grid("Upload a file to match containers from this centre.")}
        <div className="flex flex-wrap items-center gap-2">
          {moveButton}
          <Button
            variant="secondary"
            onClick={() => {
              setRows(base);
              setSelected([]);
            }}
          >
            Reset
          </Button>
          {anyRail ? <WagonControls sessionKey={sessionKey} /> : null}
        </div>
      </TabsContent>
    </Tabs>
  );
}
