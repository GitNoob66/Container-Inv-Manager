import { TrainFront, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { parseWagonFile } from "@/lib/wagons";
import { useWagonSession } from "@/lib/wagon-session";

/** "Upload wagon details" button and "Double Stack Rake" checkbox for rail movements. */
export function WagonControls({ sessionKey }: { sessionKey: string }) {
  const s = useWagonSession(sessionKey);
  const ref = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const wagons = await parseWagonFile(file);
      if (!wagons.length) {
        toast.error("No wagon numbers were found in that file.");
        return;
      }
      s.setWagons(wagons, file.name);
      toast.success(`${wagons.length} wagons loaded from ${file.name}.`);
    } catch (e) {
      toast.error(`Could not read that file: ${(e as Error).message}`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()}>
        <TrainFront className="mr-2 size-4" /> Upload wagon details
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={s.doubleStack} onCheckedChange={(v) => s.setDoubleStack(v === true)} />
        Double Stack Rake
      </label>
      {s.wagons.length ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {s.wagons.length} wagons · {s.fileName}
          <button className="rounded p-0.5 hover:text-foreground" aria-label="Clear wagons" onClick={s.clear}>
            <X className="size-3" />
          </button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">No wagon list uploaded yet.</span>
      )}
    </div>
  );
}
