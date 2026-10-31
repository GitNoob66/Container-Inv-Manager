import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Container as ContainerIcon, Lock, TrainFront } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CWC Operations Suite — Choose a module" },
      {
        name: "description",
        content: "Open the Container Inventory Manager or the CWC Summary and Haulage Generator.",
      },
      { property: "og:title", content: "CWC Operations Suite — Choose a module" },
      {
        property: "og:description",
        content: "Container inventory across centres, plus train summaries and haulage calculations, in one app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModuleHub,
});

const MODULES = [
  {
    to: "/inventory" as const,
    title: "Container Inventory Manager",
    text: "Inward and outward entries, inventory, yard positions, rakes, vehicles and reports for all 12 centres.",
    icon: ContainerIcon,
    login: true,
  },
  {
    to: "/haulage" as const,
    title: "Summary & Haulage Generator",
    text: "Train summaries, railway haulage, release memos, pendency, wagon details and RR analysis.",
    icon: TrainFront,
    login: false,
  },
];

function ModuleHub() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div className="absolute right-4 top-4 rounded-md bg-primary">
        <ThemeToggle />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">CWC Operations Suite</p>
      <h1 className="mt-2 text-center font-display text-3xl font-semibold text-foreground">Which module do you want to open?</h1>
      <div className="mt-10 grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="panel group flex flex-col gap-4 p-6 transition-all hover:-translate-y-0.5 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <m.icon className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{m.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{m.text}</p>
            </div>
            <div className="mt-auto flex items-center justify-between text-sm font-medium text-primary">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {m.login ? (
                  <>
                    <Lock className="size-3.5" /> Sign-in required
                  </>
                ) : (
                  "Opens directly"
                )}
              </span>
              <span className="flex items-center gap-1">
                Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
