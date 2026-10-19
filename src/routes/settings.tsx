import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { api, type CustomColumn } from "@/lib/api";
import { useRole } from "@/lib/role";
import { logAction } from "@/lib/session";
import { BUILTIN_COLUMNS } from "@/lib/use-field-options";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Container Yard Manager" },
      { name: "description", content: "Add, rename or remove the columns used in entry and inventory screens for each centre." },
      { property: "og:title", content: "Settings — Container Yard Manager" },
      { property: "og:description", content: "Per-centre column settings for container entry and inventory." },
    ],
  }),
  component: SettingsPage,
});

const KINDS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
];

function slug(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const BLANK = { id: "", label: "", kind: "text", options: "" };

function SettingsPage() {
  const role = useRole();
  const qc = useQueryClient();
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const [picked, setPicked] = useState("");
  const centreId = role.kind === "centre" ? role.centreId : picked || centres[0]?.id || "";
  const centre = centres.find((c) => c.id === centreId);
  const { data: config = [] } = useQuery({
    queryKey: ["custom-columns", centreId],
    queryFn: () => api.customColumns(centreId),
    enabled: !!centreId,
  });
  const [draft, setDraft] = useState(BLANK);
  const [renaming, setRenaming] = useState<{ key: string; label: string } | null>(null);

  const custom = config.filter((c) => !c.builtin);
  const override = (key: string) => config.find((c) => c.builtin && c.key === key);
  const refresh = () => qc.invalidateQueries({ queryKey: ["custom-columns"] });

  const saveCustom = async () => {
    const label = draft.label.trim();
    if (!label) {
      toast.error("Enter a column name.");
      return;
    }
    const key = draft.id ? (custom.find((c) => c.id === draft.id)?.key ?? slug(label)) : slug(label);
    if (!key) {
      toast.error("Use letters or numbers in the column name.");
      return;
    }
    if (!draft.id && (custom.some((c) => c.key === key) || BUILTIN_COLUMNS.some((b) => b.key === key))) {
      toast.error("A column with that name already exists.");
      return;
    }
    const options = draft.options.split(",").map((o) => o.trim()).filter(Boolean);
    if (draft.kind === "select" && !options.length) {
      toast.error("Add the dropdown choices, separated by commas.");
      return;
    }
    try {
      await api.upsertCustomColumn({
        ...(draft.id ? { id: draft.id } : {}),
        centre_id: centreId,
        key,
        label,
        kind: draft.kind,
        options,
        builtin: false,
        ...(draft.id ? {} : { sort: custom.length }),
      });
      logAction(centreId, centre?.name ?? null, draft.id ? "Column modified" : "Column added", label);
      toast.success(draft.id ? `Column “${label}” updated.` : `Column “${label}” added.`);
      setDraft(BLANK);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeCustom = async (c: CustomColumn) => {
    if (!window.confirm(`Delete the column “${c.label}”? Values already saved stay in old records but are no longer shown.`)) return;
    await api.deleteCustomColumn(c.id);
    logAction(centreId, centre?.name ?? null, "Column deleted", c.label);
    void refresh();
  };

  const saveBuiltin = async (key: string, patch: { label?: string; hidden?: boolean }) => {
    const def = BUILTIN_COLUMNS.find((b) => b.key === key)!;
    const cur = override(key);
    try {
      await api.upsertCustomColumn({
        ...(cur ? { id: cur.id } : {}),
        centre_id: centreId,
        key,
        label: patch.label ?? cur?.label ?? def.label,
        kind: "text",
        options: [],
        builtin: true,
        hidden: patch.hidden ?? cur?.hidden ?? false,
      });
      logAction(centreId, centre?.name ?? null, "Column modified", `${def.label}: ${JSON.stringify(patch)}`);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell
      title="Settings · Add / Modify or Delete Columns"
      actions={
        role.kind === "master" ? (
          <Select value={centreId} onValueChange={setPicked}>
            <SelectTrigger className="w-56" aria-label="Centre">
              <SelectValue placeholder="Choose a centre" />
            </SelectTrigger>
            <SelectContent>
              {centres.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      <div className="max-w-4xl space-y-5">
        <p className="text-sm text-muted-foreground">
          Columns for <span className="font-medium text-foreground">{centre?.name ?? "…"}</span>. They appear in
          Inward Entry, Outward Entry and Inventory Update, and Excel files with the same heading are read into
          them automatically. Reports include them too.
        </p>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-base font-semibold">{draft.id ? "Modify column" : "Add a column"}</h2>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Column name (Excel heading)</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Height" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dropdown choices (comma separated)</Label>
              <Input
                value={draft.options}
                disabled={draft.kind !== "select"}
                onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                placeholder="NORMAL, HC"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={saveCustom}>
                <Plus className="mr-1 size-4" /> {draft.id ? "Save" : "Add"}
              </Button>
              {draft.id ? (
                <Button variant="ghost" onClick={() => setDraft(BLANK)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
          <div className="divide-y divide-border rounded-md border border-border">
            {custom.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No extra columns yet.</p>
            ) : null}
            {custom.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{c.label}</span>
                <span className="text-xs text-muted-foreground">
                  {KINDS.find((k) => k.value === c.kind)?.label}
                  {c.kind === "select" ? ` · ${c.options.join(", ")}` : ""}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Modify ${c.label}`}
                  onClick={() => setDraft({ id: c.id, label: c.label, kind: c.kind, options: c.options.join(", ") })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Delete ${c.label}`} onClick={() => void removeCustom(c)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-base font-semibold">Standard columns</h2>
          <p className="text-xs text-muted-foreground">Rename a column to match your Excel heading, or hide columns you don't use.</p>
          <div className="divide-y divide-border rounded-md border border-border">
            {BUILTIN_COLUMNS.map((b) => {
              const o = override(b.key);
              const label = o?.label || b.label;
              const hidden = o?.hidden ?? false;
              return (
                <div key={b.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {renaming?.key === b.key ? (
                    <Input
                      autoFocus
                      className="h-8 flex-1"
                      value={renaming.label}
                      onChange={(e) => setRenaming({ key: b.key, label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renaming.label.trim()) {
                          void saveBuiltin(b.key, { label: renaming.label.trim() });
                          setRenaming(null);
                        }
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onBlur={() => {
                        if (renaming.label.trim() && renaming.label.trim() !== label) {
                          void saveBuiltin(b.key, { label: renaming.label.trim() });
                        }
                        setRenaming(null);
                      }}
                    />
                  ) : (
                    <span className={hidden ? "flex-1 text-muted-foreground line-through" : "flex-1"}>
                      {label}
                      {label !== b.label ? <span className="ml-2 text-xs text-muted-foreground">({b.label})</span> : null}
                    </span>
                  )}
                  <Button size="icon" variant="ghost" aria-label={`Rename ${b.label}`} onClick={() => setRenaming({ key: b.key, label })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={b.locked}
                    aria-label={hidden ? `Show ${b.label}` : `Hide ${b.label}`}
                    title={b.locked ? "This column is always needed" : hidden ? "Show" : "Hide"}
                    onClick={() => void saveBuiltin(b.key, { hidden: !hidden })}
                  >
                    {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
