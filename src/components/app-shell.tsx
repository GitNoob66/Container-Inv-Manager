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

export const CENTRE_SECTIONS = [
  { key: "inward", label: "Inward Entry" },
  { key: "inventory", label: "Inventory Update" },
  { key: "yard", label: "Yard Positions" },
  { key: "size-type", label: "Size / Type Update" },
  { key: "outward", label: "Outward Entry" },
  { key: "log", label: "Master Log" },
];

export function CentrePicker({ centreId }: { centreId?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const current = centres.find((c) => c.id === centreId);

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

        <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
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
          <Link to="/centres" className={navClass(pathname === "/centres")}>
            <Building2 className="size-4" />B · Update Centres
          </Link>
          <Link to="/reports" className={navClass(pathname === "/reports")}>
            <FileSpreadsheet className="size-4" />C · Reports
          </Link>
          <Link to="/rakes" className={navClass(pathname === "/rakes")}>
            <Train className="size-4" />D · Rake Manager
          </Link>
          <Link to="/" className={navClass(pathname === "/")}>
            <Warehouse className="size-4" />
            Dashboard
          </Link>
        </div>

        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground/50">
            <ScrollText className="size-3" /> Master log active
          </span>
          <ThemeToggle />
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
            <Button asChild size="sm" variant="secondary">
              <Link to="/centres">Centres</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/reports">Reports</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/rakes">Rakes</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
