import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vehicles } from "@/features/vehicles";
import { api } from "@/lib/api";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicle Management — Container Yard Manager" },
      { name: "description", content: "Keep each centre's register of trucks and pickups, with Excel import." },
      { property: "og:title", content: "Vehicle Management — Container Yard Manager" },
      { property: "og:description", content: "Truck and pickup register for every container centre." },
    ],
  }),
  component: VehiclesPage,
});

function VehiclesPage() {
  const role = useRole();
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const [picked, setPicked] = useState("");
  const centreId = role.kind === "centre" ? role.centreId : picked || centres[0]?.id || "";
  const centre = centres.find((c) => c.id === centreId);

  return (
    <AppShell
      title="Vehicle Management"
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
      {centre ? <Vehicles centre={centre} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
    </AppShell>
  );
}
