import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Centre } from "@/lib/api";
import { logAction } from "@/lib/session";

export function SizeTypeUpdate({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const { data: sizes = [] } = useQuery({ queryKey: ["sizes"], queryFn: api.sizeOptions });
  const { data: types = [] } = useQuery({ queryKey: ["types"], queryFn: api.typeOptions });
  const [sizeLabel, setSizeLabel] = useState("");
  const [sizeTeu, setSizeTeu] = useState("1");
  const [typeLabel, setTypeLabel] = useState("");
  const [typeSubs, setTypeSubs] = useState("");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["sizes"] });
    void qc.invalidateQueries({ queryKey: ["types"] });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Sizes</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="e.g. 53ft"
            value={sizeLabel}
            onChange={(e) => setSizeLabel(e.target.value)}
            className="flex-1"
          />
          <div className="w-24">
            <Input
              type="number"
              step="0.5"
              value={sizeTeu}
              onChange={(e) => setSizeTeu(e.target.value)}
              aria-label="TEU"
            />
          </div>
          <Button
            onClick={async () => {
              if (!sizeLabel.trim()) return;
              try {
                await api.upsertSize({ label: sizeLabel.trim(), teu: Number(sizeTeu) || 1 });
                logAction(centre.id, centre.name, "Size created", sizeLabel.trim());
                setSizeLabel("");
                refresh();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <Label className="text-[11px] text-muted-foreground">Label and TEU value</Label>
        <div className="divide-y divide-border rounded-md border border-border">
          {sizes.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1">{s.label}</span>
              <span className="num text-xs text-muted-foreground">{s.teu} TEU</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await api.deleteSize(s.id);
                  logAction(centre.id, centre.name, "Size deleted", s.label);
                  refresh();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Types</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="e.g. Ventilated"
            value={typeLabel}
            onChange={(e) => setTypeLabel(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Sub types, comma separated"
            value={typeSubs}
            onChange={(e) => setTypeSubs(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={async () => {
              if (!typeLabel.trim()) return;
              try {
                await api.upsertType({
                  label: typeLabel.trim(),
                  subtypes: typeSubs
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                logAction(centre.id, centre.name, "Type created", typeLabel.trim());
                setTypeLabel("");
                setTypeSubs("");
                refresh();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="divide-y divide-border rounded-md border border-border">
          {types.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.subtypes.join(" · ")}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await api.deleteType(t.id);
                  logAction(centre.id, centre.name, "Type deleted", t.label);
                  refresh();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
