import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Container as ContainerIcon,
  FileSpreadsheet,
  ScrollText,
  Train,
  Warehouse,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocalBackupControls } from "@/components/local-backup-controls";
import { ResetDataDialog } from "@/components/reset-data-dialog";
import { setRole, useRole } from "@/lib/role";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CENTRE_SECTIONS = [
  { key: "inward", label: "Inward Entry" },
  { key: "inventory", label: "Inventory Update" },
  { key: "yard", label: "Yard Positions" },
  { key: "size-type", label: "Size / Type Update" },
  { key: "outward", label: "Outward Entry" },
  { key: "vehicles", label: "Vehicle Management" },
  { key: "log", label: "Master Log" },
];

export function CentrePicker({ centreId }: { centreId?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = useRole();
  const { data: allCentres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const centres = role.kind === "centre" ? allCentres.filter((c) => c.id === role.centreId) : allCentres;
  const current = allCentres.find((c) => c.id === centreId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex w-full items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-left text-sm text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/70"
          aria-label="Choose centre"
        >
          <span className="truncate">{current ? current.name : "Choose a centre…"}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search centres…" />
          <CommandList>
            <CommandEmpty>No centre found.</CommandEmpty>
            <CommandGroup>
              {centres.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    setOpen(false);
                    navigate({
                      to: "/centre/$centreId/$section",
                      params: { centreId: c.id, section: "inward" },
                    });
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", c.id === centreId ? "opacity-100" : "opacity-0")}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RoleSwitcher() {
  const role = useRole();
  const navigate = useNavigate();
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const value = role.kind === "master" ? "master" : role.centreId;
  return (
    <div className="mb-4 space-y-1">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        Working as
      </div>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "master") {
            setRole({ kind: "master" });
            void navigate({ to: "/" });
          } else {
            setRole({ kind: "centre", centreId: v });
            void navigate({ to: "/centre/$centreId/$section", params: { centreId: v, section: "inward" } });
          }
        }}
      >
        <SelectTrigger aria-label="Working role" className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="master">Master User</SelectItem>
          {centres.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              Centre User · {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell({
  children,
  centreId,
  title,
  actions,
}: {
  children: ReactNode;
  centreId?: string;
  title: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = useRole();
  const isMaster = role.kind === "master";
  const { data: centreList = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const ownCentreName =
    role.kind === "centre" ? centreList.find((c) => c.id === role.centreId)?.name : undefined;
  const navClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/" className="mb-6 flex items-center gap-2 px-1">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ContainerIcon className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold text-sidebar-foreground">
              Container Yard
            </div>
            <div className="text-[11px] text-sidebar-foreground/60">Inventory Manager</div>
          </div>
        </Link>

        <RoleSwitcher />

        <Link to="/" className={navClass(pathname === "/")}>
          <Warehouse className="size-4" />
          Dashboard
        </Link>

        <div className="mb-1 mt-5 px-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          A · Centre
        </div>
        <CentrePicker centreId={centreId} />

        {centreId ? (
          <nav className="mt-2 flex flex-col gap-0.5 border-l border-sidebar-border/60 pl-2">
            {CENTRE_SECTIONS.map((s) => (
              <Link
                key={s.key}
                to="/centre/$centreId/$section"
                params={{ centreId, section: s.key }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                  pathname.endsWith(`/${s.key}`)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="mt-6 flex flex-col gap-0.5">
          {isMaster ? (
            <Link to="/centres" className={navClass(pathname === "/centres")}>
              <Building2 className="size-4" />B · Update Centres
            </Link>
          ) : null}
          <Link to="/reports" className={navClass(pathname === "/reports")}>
            <FileSpreadsheet className="size-4" />C · Reports
          </Link>
          {isMaster ? (
            <Link to="/rakes" className={navClass(pathname === "/rakes")}>
              <Train className="size-4" />D · Rake Manager
            </Link>
          ) : null}
        </div>

        <div className="mt-auto space-y-2 pt-6">
          <LocalBackupControls />
          <ResetDataDialog role={role} {...(ownCentreName ? { centreName: ownCentreName } : {})} />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground/50">
              <ScrollText className="size-3" /> Master log active
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
          <h1 className="font-display text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="min-w-0 flex-1 p-5">{children}</main>
        <div className="border-t border-border bg-card p-3 md:hidden">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/">Dashboard</Link>
            </Button>
            {isMaster ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/centres">Centres</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link to="/reports">Reports</Link>
            </Button>
            {isMaster ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/rakes">Rakes</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
