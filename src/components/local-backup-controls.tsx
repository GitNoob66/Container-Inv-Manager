import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportLocalBackup, importLocalBackup, isOfflineMode } from "@/lib/local-api";

export function LocalBackupControls() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  if (!isOfflineMode) return null;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Button
        size="sm"
        variant="ghost"
        className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={() => void exportLocalBackup().then(() => toast.success("Backup saved."))}
      >
        <Download className="size-3.5" /> Backup
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" /> Restore
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".cym-backup,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!window.confirm("Restore this backup? Current records on this PC will be replaced.")) return;
          void importLocalBackup(file)
            .then(async () => {
              await queryClient.invalidateQueries();
              toast.success("Backup restored.");
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Restore failed."));
        }}
      />
    </div>
  );
}