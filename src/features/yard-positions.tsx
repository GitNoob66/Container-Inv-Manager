import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Centre } from "@/lib/api";
import { logAction } from "@/lib/session";

export function YardPositions({ centre }: { centre: Centre }) {
  const qc = useQueryClient();
  const { data: positions = [] } = useQuery({
    queryKey: ["yard", centre.id],
    queryFn: () => api.yardPositions(centre.id),
  });
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["yard", centre.id] });

  const add = async () => {
    if (!name.trim()) return;
    try {
      await api.createYardPosition(centre.id, name.trim());
      logAction(centre.id, centre.name, "Yard position created", name.trim());
      setName("");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="panel space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Physical positions where containers sit at {centre.name}.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Block A-01"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}>
            <Plus className="mr-1 size-4" /> Add
          </Button>
        </div>
      </div>

      <div className="panel divide-y divide-border">
        {positions.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No yard positions yet.</p>
        ) : null}
        {positions.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
            {editingId === p.id ? (
              <>
                <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8" />
                <Button
                  size="sm"
                  onClick={async () => {
                    await api.updateYardPosition(p.id, editValue.trim());
                    logAction(centre.id, centre.name, "Yard position updated", `${p.name} → ${editValue}`);
                    setEditingId(null);
                    void refresh();
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{p.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(p.id);
                    setEditValue(p.name);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await api.deleteYardPosition(p.id);
                    logAction(centre.id, centre.name, "Yard position deleted", p.name);
                    void refresh();
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
