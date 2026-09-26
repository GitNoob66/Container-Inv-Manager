import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Centre } from "@/lib/api";
import { downloadText, sessionStart } from "@/lib/session";

export function MasterLog({ centre }: { centre: Centre }) {
  const since = typeof window === "undefined" ? undefined : sessionStart();
  const { data: sessionLogs = [] } = useQuery({
    queryKey: ["logs", centre.id, since],
    queryFn: () => api.logs(centre.id, since),
    refetchInterval: 10000,
  });
  const { data: allLogs = [] } = useQuery({
    queryKey: ["logs-all", centre.id],
    queryFn: () => api.logs(centre.id),
  });

  const asText = (rows: typeof allLogs, heading: string) =>
    [
      `MASTER LOG — ${centre.name}`,
      heading,
      `Generated: ${new Date().toLocaleString()}`,
      "".padEnd(70, "="),
      ...rows.map(
        (l) =>
          `${new Date(l.created_at).toLocaleString()}  |  ${l.action}${l.details ? `  |  ${l.details}` : ""}`,
      ),
      "".padEnd(70, "="),
      `${rows.length} entries`,
    ].join("\n");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            downloadText(
              `master-log-${centre.name.replace(/\s+/g, "-")}-session.txt`,
              asText(sessionLogs, "Current session"),
            )
          }
        >
          <Download className="mr-2 size-4" /> Download this session ({sessionLogs.length})
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            downloadText(
              `master-log-${centre.name.replace(/\s+/g, "-")}-full.txt`,
              asText(allLogs, "Full history"),
            )
          }
        >
          <Download className="mr-2 size-4" /> Download full history ({allLogs.length})
        </Button>
      </div>

      <div className="panel max-h-[60vh] overflow-auto p-4 font-mono text-xs leading-6">
        {allLogs.length === 0 ? (
          <p className="text-muted-foreground">No activity recorded for this centre yet.</p>
        ) : null}
        {[...allLogs].reverse().map((l) => (
          <div key={l.id} className="border-b border-border/60 py-1">
            <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>{" "}
            <span className="font-semibold">{l.action}</span>
            {l.details ? <span className="text-muted-foreground"> — {l.details}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
