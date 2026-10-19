import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { exportLocalBackup, isOfflineMode, resetAllLocalData, resetCentreLocalData } from "@/lib/local-api";
import type { AppRole } from "@/lib/role";

export function ResetDataDialog({ role, centreName }: { role: AppRole; centreName?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  if (!isOfflineMode) return null;

  const isMaster = role.kind === "master";
  const scope = isMaster ? "all centres on this PC" : (centreName ?? "your centre");

  const reset = async () => {
    setBusy(true);
    try {
      if (role.kind === "master") await resetAllLocalData();
      else await resetCentreLocalData(role.centreId);
      queryClient.clear();
      setOpen(false);
      toast.success("Data has been reset.");
      void navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-destructive/15 hover:text-destructive"
        >
          <RotateCcw className="size-3.5" /> Reset data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset data for {scope}?</DialogTitle>
          <DialogDescription>
            {isMaster
              ? "Every container, yard position, rake, vehicle and log will be permanently erased. The 12 default centres and standard sizes/types will be restored."
              : "All containers, yard positions, vehicles and logs of this centre will be permanently erased. Other centres are not affected."}{" "}
            This cannot be undone. We strongly recommend downloading a backup first.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="secondary"
          onClick={() => void exportLocalBackup().then(() => toast.success("Backup saved."))}
        >
          <Download className="mr-2 size-4" /> Download backup first
        </Button>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void reset()}>
            Reset data now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
