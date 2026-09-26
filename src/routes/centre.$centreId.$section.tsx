import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, CENTRE_SECTIONS } from "@/components/app-shell";
import { InwardEntry } from "@/features/inward-entry";
import { InventoryUpdate } from "@/features/inventory-update";
import { MasterLog } from "@/features/master-log";
import { OutwardEntry } from "@/features/outward-entry";
import { SizeTypeUpdate } from "@/features/size-type";
import { YardPositions } from "@/features/yard-positions";
import { api } from "@/lib/api";

export const Route = createFileRoute("/centre/$centreId/$section")({
  head: () => ({
    meta: [
      { title: "Centre Operations — Container Yard Manager" },
      {
        name: "description",
        content:
          "Record inward and outward container movements, update inventory, yard positions and sizes for a depot.",
      },
      { property: "og:title", content: "Centre Operations — Container Yard Manager" },
      {
        property: "og:description",
        content: "Inward, outward and inventory management for a container depot.",
      },
    ],
  }),
  component: CentreSection,
});

function CentreSection() {
  const { centreId, section } = Route.useParams();
  const { data: centre, isLoading } = useQuery({
    queryKey: ["centre", centreId],
    queryFn: () => api.centre(centreId),
  });

  const label = CENTRE_SECTIONS.find((s) => s.key === section)?.label ?? "Centre";

  if (isLoading) {
    return (
      <AppShell centreId={centreId} title={label}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!centre) {
    return (
      <AppShell title="Centre not found">
        <p className="text-sm text-muted-foreground">
          This centre no longer exists. Pick another one from the list on the left.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell centreId={centreId} title={`${centre.name} · ${label}`}>
      {section === "inward" ? <InwardEntry centre={centre} /> : null}
      {section === "inventory" ? <InventoryUpdate centre={centre} /> : null}
      {section === "yard" ? <YardPositions centre={centre} /> : null}
      {section === "size-type" ? <SizeTypeUpdate centre={centre} /> : null}
      {section === "outward" ? <OutwardEntry centre={centre} /> : null}
      {section === "log" ? <MasterLog centre={centre} /> : null}
      {!CENTRE_SECTIONS.some((s) => s.key === section) ? (
        <p className="text-sm text-muted-foreground">Choose an option from the left.</p>
      ) : null}
    </AppShell>
  );
}
