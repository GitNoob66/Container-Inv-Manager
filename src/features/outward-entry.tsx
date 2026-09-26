import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EditableGrid, type GridRow } from "@/components/editable-grid";
import { FlexiUpload } from "@/components/flexi-upload";
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
import { MODES, RAIL_OWNERSHIP } from "@/lib/container-fields";
import { logAction } from "@/lib/session";
import { useFieldOptions } from "@/lib/use-field-options";

function toRow(c: Container, now: { date: string; time: string }): GridRow {
  return {
    __id: c.id,
    container_no: c.container_no,
    out_mode: "Road",
    out_rail_ownership: "",
    out_rake_name: "",
    out_date: now.date,
    out_time: now.time,
    size: c.size ?? "",
    status: c.status ?? "",
    account: c.account ?? "",
    yard_position: c.yard_position ?? "",
  };
}

export function OutwardEntry({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const { outwardColumns, rakes } = useFieldOptions(centre.id);
  const { data: containers = [] } = useQuery({
    queryKey: ["containers", centre.id],
    queryFn: () => api.containers(centre.id),
  });

  const nowParts = useMemo(() => {
    const n = new Date();
    return { date: n.toISOString().slice(0, 10), time: n.toTimeString().slice(0, 5) };
  }, []);

  const [rows, setRows] = useState<GridRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState({
    out_mode: "Road",
    out_rail_ownership: "",
    out_rake_name: "",
    out_date: nowParts.date,
    out_time: nowParts.time,
  });

  const base = useMemo(() => containers.map((c) => toRow(c, nowParts)), [containers, nowParts]);
  useEffect(() => setRows(base), [base]);

  const dispatch = async (ids: string[]) => {
    if (!ids.length) {
      toast.error("Select at least one container.");
      return;
    }
    try {
      for (const id of ids) {
        const r = rows.find((x) => x.__id === id);
        if (!r) continue;
        await api.updateContainer(id, {
          out_mode: r.out_mode || null,
          out_rail_ownership: r.out_mode === "Rail" ? r.out_rail_ownership || null : null,
          out_rake_name: r.out_mode === "Rail" ? r.out_rake_name || null : null,
          out_date: r.out_date || null,
          out_time: r.out_time || null,
          yard_position: r.yard_position || null,
          dispatched: true,
        });
      }
      logAction(centre.id, centre.name, "Outward entry", `${ids.length} containers dispatched`);
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
    toast.success("Out details applied.");
  };

  return (
    <Tabs defaultValue="manual" className="space-y-4">
      <TabsList>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        <TabsTrigger value="flexi">Automatic Entry (Flexi)</TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="space-y-4">
        <div className="panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Out Mode</Label>
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
          </div>
          {bulk.out_mode === "Rail" ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake Own / Other</Label>
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
            </div>
          ) : null}
          {bulk.out_mode === "Rail" && bulk.out_rail_ownership === "Own" ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake</Label>
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
            </div>
          ) : null}
          {bulk.out_mode === "Rail" && bulk.out_rail_ownership === "Other" ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake Name</Label>
              <Input
                value={bulk.out_rake_name}
                onChange={(e) => setBulk((b) => ({ ...b, out_rake_name: e.target.value }))}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Out Date</Label>
            <Input
              type="date"
              value={bulk.out_date}
              onChange={(e) => setBulk((b) => ({ ...b, out_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Out Time (24h)</Label>
            <Input
              type="time"
              value={bulk.out_time}
              onChange={(e) => setBulk((b) => ({ ...b, out_time: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={applyBulk} className="w-full">
              Apply to selected
            </Button>
          </div>
        </div>

        <EditableGrid
          columns={outwardColumns}
          rows={rows}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          onCellChange={(id, key, value) =>
            setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, [key]: value } : r)))
          }
          onColumnFill={(key, value) => setRows((rs) => rs.map((r) => ({ ...r, [key]: value })))}
          emptyMessage="No containers available for outward movement."
        />

        <Button onClick={() => dispatch(selected)} disabled={!selected.length}>
          <LogOut className="mr-2 size-4" /> Move out {selected.length || ""} container
          {selected.length === 1 ? "" : "s"}
        </Button>
      </TabsContent>

      <TabsContent value="flexi" className="space-y-4">
        <FlexiUpload
          onParsed={(result) => {
            const matched = base.filter((r) =>
              result.rows.some((p) => p.containerNo === r.container_no),
            );
            const missing = result.rows.filter(
              (p) => !base.some((r) => r.container_no === p.containerNo),
            );
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
        <EditableGrid
          columns={outwardColumns}
          rows={rows}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          onCellChange={(id, key, value) =>
            setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, [key]: value } : r)))
          }
          onColumnFill={(key, value) => setRows((rs) => rs.map((r) => ({ ...r, [key]: value })))}
          emptyMessage="Upload a file to match containers from this centre."
        />
        <div className="flex gap-2">
          <Button onClick={() => dispatch(selected)} disabled={!selected.length}>
            <LogOut className="mr-2 size-4" /> Move out {selected.length || ""} container
            {selected.length === 1 ? "" : "s"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setRows(base);
              setSelected([]);
            }}
          >
            Reset
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
