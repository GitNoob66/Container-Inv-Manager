import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet } from "lucide-react";
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
import { api } from "@/lib/api";
import { buildContainerWorkbook, downloadWorkbook } from "@/lib/reports";
import { logAction } from "@/lib/session";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Container Yard Manager" },
      {
        name: "description",
        content:
          "Generate Excel reports for all centres, a single centre, or containers dispatched over a chosen period.",
      },
      { property: "og:title", content: "Reports — Container Yard Manager" },
      { property: "og:description", content: "Excel reports for container inventory and dispatches." },
    ],
  }),
  component: ReportsPage,
});

const PERIODS = [
  { key: "365", label: "Last 1 year" },
  { key: "180", label: "Last 6 months" },
  { key: "90", label: "Last 3 months" },
  { key: "30", label: "Last 30 days" },
  { key: "custom", label: "Custom period" },
];

function ReportsPage() {
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const [centreId, setCentreId] = useState("");
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const nameById = Object.fromEntries(centres.map((c) => [c.id, c.name]));

  const allCentres = async () => {
    setBusy(true);
    try {
      const rows = await api.allContainers();
      downloadWorkbook(
        buildContainerWorkbook(rows, nameById, "Container Inventory — All Centres"),
        `all-centres-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      logAction(null, null, "Report generated", `All centres (${rows.length} containers)`);
      toast.success(`Report with ${rows.length} containers downloaded.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const specificCentre = async () => {
    if (!centreId) return toast.error("Choose a centre first.");
    setBusy(true);
    try {
      const rows = await api.containers(centreId);
      downloadWorkbook(
        buildContainerWorkbook(rows, nameById, `Container Inventory — ${nameById[centreId]}`),
        `${nameById[centreId].replace(/\s+/g, "-")}-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      logAction(centreId, nameById[centreId], "Report generated", `${rows.length} containers`);
      toast.success(`Report with ${rows.length} containers downloaded.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dispatchReport = async () => {
    if (!centreId) return toast.error("Choose a centre first.");
    let start = from;
    let end = to;
    if (period !== "custom") {
      const days = Number(period);
      const endDate = new Date();
      const startDate = new Date(Date.now() - days * 86400000);
      start = startDate.toISOString().slice(0, 10);
      end = endDate.toISOString().slice(0, 10);
    }
    if (!start || !end) return toast.error("Choose both dates for the custom period.");
    setBusy(true);
    try {
      const rows = await api.dispatchedContainers(centreId, start, end);
      downloadWorkbook(
        buildContainerWorkbook(
          rows,
          nameById,
          `Dispatch Report — ${nameById[centreId]} (${start} to ${end})`,
        ),
        `${nameById[centreId].replace(/\s+/g, "-")}-dispatch-${start}-to-${end}.xlsx`,
      );
      logAction(
        centreId,
        nameById[centreId],
        "Dispatch report generated",
        `${start} to ${end}: ${rows.length} containers`,
      );
      toast.success(`${rows.length} dispatched containers exported.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="C · Generate Reports">
      <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">All Centres</h2>
          <p className="text-sm text-muted-foreground">
            One Excel file with every container currently held across all centres.
          </p>
          <Button onClick={allCentres} disabled={busy}>
            <FileSpreadsheet className="mr-2 size-4" /> Generate
          </Button>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">Specific Centre</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Centre</Label>
            <Select value={centreId} onValueChange={setCentreId}>
              <SelectTrigger>
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
          </div>
          <Button onClick={specificCentre} disabled={busy}>
            <FileSpreadsheet className="mr-2 size-4" /> Generate inventory report
          </Button>
        </section>

        <section className="panel space-y-3 p-5 lg:col-span-2">
          <h2 className="font-display text-base font-semibold">Dispatch Report</h2>
          <p className="text-sm text-muted-foreground">
            Containers moved out of the chosen centre during a period, with out date and time.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {period === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            ) : null}
          </div>
          <Button onClick={dispatchReport} disabled={busy}>
            <FileSpreadsheet className="mr-2 size-4" /> Generate dispatch report
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
