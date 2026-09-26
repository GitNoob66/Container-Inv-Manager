import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Centre } from "@/lib/api";
import { logAction } from "@/lib/session";

export const Route = createFileRoute("/centres")({
  head: () => ({
    meta: [
      { title: "Update Centres — Container Yard Manager" },
      {
        name: "description",
        content: "Create, rename and remove the depots and container centres tracked by the system.",
      },
      { property: "og:title", content: "Update Centres — Container Yard Manager" },
      { property: "og:description", content: "Manage the master list of container centres." },
    ],
  }),
  component: CentresPage,
});

function CentresPage() {
  const qc = useQueryClient();
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const [draft, setDraft] = useState({ name: "", code: "", location: "" });
  const [editing, setEditing] = useState<Centre | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["centres"] });

  const save = async () => {
    if (!draft.name.trim()) return;
    try {
      if (editing) {
        await api.updateCentre(editing.id, draft);
        logAction(editing.id, draft.name, "Centre updated", draft.name);
      } else {
        const created = (await api.createCentre(draft)) as unknown as Centre;
        logAction(created.id, created.name, "Centre created", created.name);
      }
      setDraft({ name: "", code: "", location: "" });
      setEditing(null);
      void refresh();
      toast.success("Centre saved.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="B · Update Centres">
      <div className="max-w-3xl space-y-5">
        <div className="panel space-y-3 p-4">
          <h2 className="font-display text-base font-semibold">
            {editing ? `Edit ${editing.name}` : "Add a centre"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Centre name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              placeholder="Code (optional)"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <Input
              placeholder="Location (optional)"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>
              <Plus className="mr-1 size-4" /> {editing ? "Save changes" : "Add centre"}
            </Button>
            {editing ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setDraft({ name: "", code: "", location: "" });
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        <div className="panel divide-y divide-border">
          {centres.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.code, c.location].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(c);
                  setDraft({ name: c.name, code: c.code ?? "", location: c.location ?? "" });
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm(`Delete ${c.name} and all its containers?`)) return;
                  await api.deleteCentre(c.id);
                  logAction(null, c.name, "Centre deleted", c.name);
                  void refresh();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
