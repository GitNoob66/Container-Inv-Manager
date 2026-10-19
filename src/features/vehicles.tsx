import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Centre, type Vehicle } from "@/lib/api";
import { canEditVehicles, useRole } from "@/lib/role";
import { logAction } from "@/lib/session";

type Draft = Omit<Vehicle, "id" | "centre_id" | "created_at"> & { id?: string };

const EMPTY: Draft = {
  vehicle_no: "",
  vehicle_type: "",
  transporter: "",
  driver_name: "",
  driver_phone: "",
  remarks: "",
};

const FIELDS: { key: keyof Draft; label: string; placeholder: string }[] = [
  { key: "vehicle_no", label: "Vehicle No.", placeholder: "e.g. GJ39TA0980" },
  { key: "vehicle_type", label: "Vehicle Type", placeholder: "e.g. Trailer 40ft" },
  { key: "transporter", label: "Transporter", placeholder: "Company name" },
  { key: "driver_name", label: "Driver Name", placeholder: "" },
  { key: "driver_phone", label: "Driver Phone", placeholder: "" },
  { key: "remarks", label: "Remarks", placeholder: "" },
];

export function Vehicles({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const role = useRole();
  const editable = canEditVehicles(role, centre.id);
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", centre.id],
    queryFn: () => api.vehicles(centre.id),
  });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [search, setSearch] = useState("");

  const save = async () => {
    const no = draft.vehicle_no.trim().toUpperCase();
    if (!no) {
      toast.error("Vehicle number is required.");
      return;
    }
    try {
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
      await api.upsertVehicle({
        ...(draft.id ? { id: draft.id } : {}),
        centre_id: centre.id,
        vehicle_no: no,
        vehicle_type: clean(draft.vehicle_type),
        transporter: clean(draft.transporter),
        driver_name: clean(draft.driver_name),
        driver_phone: clean(draft.driver_phone),
        remarks: clean(draft.remarks),
      });
      logAction(centre.id, centre.name, draft.id ? "Vehicle updated" : "Vehicle registered", no);
      toast.success(draft.id ? `Vehicle ${no} updated.` : `Vehicle ${no} registered.`);
      setDraft(EMPTY);
      void qc.invalidateQueries({ queryKey: ["vehicles"] });
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg.includes("duplicate") ? `Vehicle ${no} is already registered at this centre.` : msg);
    }
  };

  const remove = async (v: Vehicle) => {
    if (!window.confirm(`Delete vehicle ${v.vehicle_no}?`)) return;
    await api.deleteVehicle(v.id);
    logAction(centre.id, centre.name, "Vehicle deleted", v.vehicle_no);
    void qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const term = search.trim().toUpperCase();
  const shown = term
    ? vehicles.filter((v) =>
        [v.vehicle_no, v.transporter, v.driver_name].some((x) => (x ?? "").toUpperCase().includes(term)),
      )
    : vehicles;

  return (
    <div className="space-y-4">
      {editable ? (
        <div className="panel space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold">
            {draft.id ? "Edit vehicle" : "Register a vehicle"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  value={draft[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>
              <Plus className="mr-1 size-4" /> {draft.id ? "Save changes" : "Add vehicle"}
            </Button>
            {draft.id ? (
              <Button variant="ghost" onClick={() => setDraft(EMPTY)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="panel p-4 text-sm text-muted-foreground">
          Read-only view. Vehicles are managed by the {centre.name} centre user.
        </p>
      )}

      <div className="relative max-w-sm">
        <Input placeholder="Search vehicle, transporter or driver…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search ? (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")} aria-label="Clear search">
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {FIELDS.map((f) => (
                <th key={f.key} className="px-3 py-2 font-semibold">{f.label}</th>
              ))}
              {editable ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">No vehicles registered.</td>
              </tr>
            ) : null}
            {shown.map((v) => (
              <tr key={v.id}>
                <td className="num px-3 py-2 font-medium">{v.vehicle_no}</td>
                <td className="px-3 py-2">{v.vehicle_type}</td>
                <td className="px-3 py-2">{v.transporter}</td>
                <td className="px-3 py-2">{v.driver_name}</td>
                <td className="px-3 py-2">{v.driver_phone}</td>
                <td className="px-3 py-2">{v.remarks}</td>
                {editable ? (
                  <td className="whitespace-nowrap px-3 py-1 text-right">
                    <Button size="icon" variant="ghost" aria-label="Edit vehicle" onClick={() => setDraft({ ...v })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete vehicle" onClick={() => void remove(v)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
