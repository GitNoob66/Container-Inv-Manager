import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type Rake } from "@/lib/api";
import { parseRakeFile, planRakeImport } from "@/lib/rake-import";
import { logAction } from "@/lib/session";

const RAKE_TYPES = ["BLSS", "BLCM", "BLCS", "Other"];

export const Route = createFileRoute("/rakes")({
  head: () => ({
    meta: [
      { title: "Rake Manager — Container Yard Manager" },
      {
        name: "description",
        content:
          "Add, edit and remove rakes with basing, BPC due date, ownership, wagon count and current user.",
      },
      { property: "og:title", content: "Rake Manager — Container Yard Manager" },
      { property: "og:description", content: "Maintain the fleet of rakes used for rail movements." },
    ],
  }),
  component: RakesPage,
});

const blank = {
  rake_name: "",
  rake_id: "",
  rake_basing: "",
  bpc_due_date: "",
  ownership: "Owned",
  wagons: "",
  current_user_type: "Self",
  rake_type: "",
  rake_type_other: "",
};

function RakesPage() {
  const qc = useQueryClient();
  const { data: rakes = [] } = useQuery({ queryKey: ["rakes"], queryFn: api.rakes });
  const [draft, setDraft] = useState({ ...blank });
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async () => {
    if (!draft.rake_name.trim()) {
      toast.error("Rake name is required.");
      return;
    }
    try {
      await api.upsertRake({
        ...(editingId ? { id: editingId } : {}),
        rake_name: draft.rake_name.trim(),
        rake_id: draft.rake_id || null,
        rake_basing: draft.rake_basing || null,
        bpc_due_date: draft.bpc_due_date || null,
        ownership: draft.ownership,
        wagons: draft.wagons ? Number(draft.wagons) : null,
        current_user_type: draft.current_user_type,
        rake_type: (draft.rake_type === "Other" ? draft.rake_type_other.trim() || "Other" : draft.rake_type) || null,
      });
      logAction(null, null, editingId ? "Rake updated" : "Rake created", draft.rake_name);
      setDraft({ ...blank });
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["rakes"] });
      toast.success("Rake saved.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const edit = (r: Rake) => {
    setEditingId(r.id);
    setDraft({
      rake_name: r.rake_name,
      rake_id: r.rake_id ?? "",
      rake_basing: r.rake_basing ?? "",
      bpc_due_date: r.bpc_due_date ?? "",
      ownership: r.ownership,
      wagons: r.wagons != null ? String(r.wagons) : "",
      current_user_type: r.current_user_type,
      rake_type: !r.rake_type ? "" : RAKE_TYPES.includes(r.rake_type) ? r.rake_type : "Other",
      rake_type_other: r.rake_type && !RAKE_TYPES.includes(r.rake_type) ? r.rake_type : "",
    });
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const incoming = await parseRakeFile(file);
      if (!incoming.length) {
        toast.error("No rakes were found in that file.");
        return;
      }
      const plan = planRakeImport(rakes, incoming);
      await Promise.all(plan.updates.map((u) => api.upsertRake({ id: u.id, ...u.patch })));
      await Promise.all(plan.inserts.map((r) => api.upsertRake({ ...r, ownership: "Owned", current_user_type: "Self" })));
      logAction(null, null, "Rakes imported", `${file.name}: ${plan.inserts.length} added, ${plan.updates.length} updated`);
      toast.success(`${plan.inserts.length} rake(s) added, ${plan.updates.length} updated.`);
      void qc.invalidateQueries({ queryKey: ["rakes"] });
    } catch (e) {
      toast.error(`Could not read that file: ${(e as Error).message}`);
    }
  };

  return (
    <AppShell title="D · Rake Manager">
      <div className="space-y-5">
        <div className="panel space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">
              {editingId ? "Edit rake" : "Add a rake"}
            </h2>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 size-4" /> Upload rakes from Excel
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake Name</Label>
              <Input
                value={draft.rake_name}
                onChange={(e) => setDraft({ ...draft, rake_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake ID</Label>
              <Input
                value={draft.rake_id}
                onChange={(e) => setDraft({ ...draft, rake_id: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake Basing</Label>
              <Input
                value={draft.rake_basing}
                onChange={(e) => setDraft({ ...draft, rake_basing: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">BPC Due Date</Label>
              <Input
                type="date"
                value={draft.bpc_due_date}
                onChange={(e) => setDraft({ ...draft, bpc_due_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ownership</Label>
              <Select
                value={draft.ownership}
                onValueChange={(v) => setDraft({ ...draft, ownership: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owned">Owned</SelectItem>
                  <SelectItem value="Hired">Hired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Number of Wagons</Label>
              <Input
                type="number"
                value={draft.wagons}
                onChange={(e) => setDraft({ ...draft, wagons: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Current User</Label>
              <Select
                value={draft.current_user_type}
                onValueChange={(v) => setDraft({ ...draft, current_user_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Self">Self</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rake Type</Label>
              <Select
                value={draft.rake_type || undefined}
                onValueChange={(v) => setDraft({ ...draft, rake_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {RAKE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft.rake_type === "Other" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Other rake type</Label>
                <Input
                  value={draft.rake_type_other}
                  placeholder="Type rake type"
                  onChange={(e) => setDraft({ ...draft, rake_type_other: e.target.value })}
                />
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <Button onClick={save} className="flex-1">
                <Plus className="mr-1 size-4" /> {editingId ? "Save" : "Add rake"}
              </Button>
              {editingId ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setDraft({ ...blank });
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-secondary-foreground">
              <tr>
                {["Rake Name", "Rake ID", "Type", "Basing", "BPC Due", "Ownership", "Wagons", "Current User", ""].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rakes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    No rakes added yet.
                  </td>
                </tr>
              ) : null}
              {rakes.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.rake_name}</td>
                  <td className="num px-3 py-2">{r.rake_id ?? "—"}</td>
                  <td className="px-3 py-2">{r.rake_type ?? "—"}</td>
                  <td className="px-3 py-2">{r.rake_basing ?? "—"}</td>
                  <td className="num px-3 py-2">{r.bpc_due_date ?? "—"}</td>
                  <td className="px-3 py-2">{r.ownership}</td>
                  <td className="num px-3 py-2">{r.wagons ?? "—"}</td>
                  <td className="px-3 py-2">{r.current_user_type}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => edit(r)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!window.confirm(`Delete rake ${r.rake_name}?`)) return;
                        await api.deleteRake(r.id);
                        logAction(null, null, "Rake deleted", r.rake_name);
                        void qc.invalidateQueries({ queryKey: ["rakes"] });
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
