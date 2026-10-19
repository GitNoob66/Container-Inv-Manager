import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { api, teuFor } from "@/lib/api";

function localDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Stat({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className={accent ? "panel border-accent/50 bg-accent/10 p-4" : "panel p-4"}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

/** Inventory overview for one centre, or all centres when centreId is empty. */
export function InventoryOverview({ centreId }: { centreId?: string }) {
  const { data: all = [] } = useQuery({ queryKey: ["containers", "all"], queryFn: api.allContainers });
  const stats = useMemo(() => {
    const rows = centreId ? all.filter((c) => c.centre_id === centreId) : all;
    const stock = rows.filter((c) => !c.dispatched);
    const since = localDate(new Date(Date.now() - 30 * 86400000));
    const count = (pred: (s: string) => boolean) => stock.filter((c) => pred(c.size ?? "")).length;
    const c20 = count((s) => s.startsWith("20"));
    const c40 = count((s) => s.startsWith("40"));
    const c45 = count((s) => s.startsWith("45"));
    const party = new Map<string, number>();
    for (const c of stock) {
      const k = c.account?.trim() || "Not set";
      party.set(k, (party.get(k) ?? 0) + 1);
    }
    return {
      total: stock.length,
      teu: stock.reduce((s, c) => s + teuFor(c.size), 0),
      c20, c40, c45,
      loaded: stock.filter((c) => c.status === "Loaded").length,
      empty: stock.filter((c) => c.status === "Empty").length,
      inward30: rows.filter((c) => (c.in_date ?? "") >= since).length,
      out30: rows.filter((c) => c.dispatched && (c.out_date ?? "") >= since).length,
      isoFlagged: stock.filter((c) => c.iso_valid === false).length,
      parties: [...party.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    };
  }, [all, centreId]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total containers" value={stats.total} sub={`${stats.teu} TEU`} accent />
        <Stat label="20ft" value={stats.c20} sub={`${stats.c20} TEU`} />
        <Stat label="40ft / 45ft" value={stats.c40 + stats.c45} sub={`${(stats.c40 + stats.c45) * 2} TEU${stats.c45 ? ` · ${stats.c45} × 45ft` : ""}`} />
        <Stat label="Loaded / Empty" value={`${stats.loaded} / ${stats.empty}`} />
        <Stat label="Inward · last 30 days" value={stats.inward30} />
        <Stat label="Dispatched · last 30 days" value={stats.out30} />
        <Stat label="ISO check failed" value={stats.isoFlagged} sub="highlighted in inventory" />
      </div>
      <div className="panel p-4">
        <h3 className="mb-3 font-display text-sm font-semibold">Containers by party</h3>
        {stats.parties.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No containers in stock.</p>
        ) : (
          <div style={{ height: Math.max(220, stats.parties.length * 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.parties} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" width={120} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                <Bar dataKey="count" name="Containers" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
