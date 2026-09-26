import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, teuFor, type Container } from "@/lib/api";
import { logAction } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Container Yard Manager — Depot Inventory" },
      {
        name: "description",
        content:
          "Track shipping container inventory across depots: inward and outward movements, TEU overview, rake management and Excel reports.",
      },
      { property: "og:title", content: "Container Yard Manager — Depot Inventory" },
      {
        property: "og:description",
        content: "Depot container inventory, TEU overview, rake management and Excel reports.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [showOverview, setShowOverview] = useState(true);

  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const { data: containers = [] } = useQuery({
    queryKey: ["containers", "all"],
    queryFn: api.allContainers,
  });
  const { data: results = [] } = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.searchContainers(query),
    enabled: query.length >= 3,
  });

  const nameById = Object.fromEntries(centres.map((c) => [c.id, c.name]));
  const inStock = useMemo(() => containers.filter((c) => !c.dispatched), [containers]);

  const bySize = useMemo(() => {
    const map = new Map<string, { count: number; teu: number }>();
    for (const c of inStock) {
      const k = c.size ?? "Unknown";
      const cur = map.get(k) ?? { count: 0, teu: 0 };
      map.set(k, { count: cur.count + 1, teu: cur.teu + teuFor(c.size) });
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [inStock]);

  const totalTeu = bySize.reduce((s, [, v]) => s + v.teu, 0);

  const runSearch = () => {
    setQuery(term.trim());
    if (term.trim().length >= 3) logAction(null, null, "Container searched", term.trim().toUpperCase());
  };

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                placeholder="Search a container number…"
                className="num pl-9 pr-9 uppercase"
                onChange={(e) => setTerm(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              {term ? (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                  onClick={() => {
                    setTerm("");
                    setQuery("");
                  }}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <Button onClick={runSearch}>
              <Search className="mr-2 size-4" /> Search
            </Button>
          </div>

          {query.length >= 3 ? (
            <div className="mt-4 overflow-x-auto">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No container matches “{query}”.</p>
              ) : (
                <SearchTable rows={results} nameById={nameById} />
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowOverview((s) => !s)}>
              <BarChart3 className="mr-2 size-4" /> {showOverview ? "Hide" : "Show"} Overview
            </Button>
            <span className="text-sm text-muted-foreground">
              {inStock.length} containers in stock · {totalTeu} TEU
            </span>
          </div>

          {showOverview ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {bySize.map(([size, v]) => (
                <div key={size} className="panel p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{size}</div>
                  <div className="num mt-1 text-2xl font-semibold">{v.count}</div>
                  <div className="text-xs text-muted-foreground">{v.teu} TEU</div>
                </div>
              ))}
              <div className="panel border-accent/50 bg-accent/10 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
                <div className="num mt-1 text-2xl font-semibold">{inStock.length}</div>
                <div className="text-xs text-muted-foreground">{totalTeu} TEU</div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold">Centres</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {centres.map((c) => {
              const rows = inStock.filter((x) => x.centre_id === c.id);
              const teu = rows.reduce((s, r) => s + teuFor(r.size), 0);
              return (
                <Link
                  key={c.id}
                  to="/centre/$centreId/$section"
                  params={{ centreId: c.id, section: "inward" }}
                  className="panel p-4 transition-shadow hover:shadow-[var(--shadow-float)]"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="num mt-2 text-xl font-semibold">{rows.length}</div>
                  <div className="text-xs text-muted-foreground">containers · {teu} TEU</div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SearchTable({
  rows,
  nameById,
}: {
  rows: Container[];
  nameById: Record<string, string>;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-secondary text-xs uppercase tracking-wide text-secondary-foreground">
        <tr>
          {["Container", "Centre", "Size", "Type", "Status", "Yard", "In Date", "State"].map((h) => (
            <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border">
            <td className="num px-3 py-2 font-medium">{r.container_no}</td>
            <td className="px-3 py-2">{nameById[r.centre_id] ?? "—"}</td>
            <td className="px-3 py-2">{r.size ?? "—"}</td>
            <td className="px-3 py-2">
              {[r.ctr_type, r.dry_subtype].filter(Boolean).join(" ") || "—"}
            </td>
            <td className="px-3 py-2">{r.status ?? "—"}</td>
            <td className="px-3 py-2">{r.yard_position ?? "—"}</td>
            <td className="num px-3 py-2">
              {[r.in_date, r.in_time].filter(Boolean).join(" ") || "—"}
            </td>
            <td className="px-3 py-2">
              {r.dispatched ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs">Dispatched</span>
              ) : (
                <span className="rounded bg-success/15 px-2 py-0.5 text-xs text-success">In yard</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
