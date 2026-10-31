import { createFileRoute } from "@tanstack/react-router";
import { HaulageApp } from "@/haulage/haulage-app";

export const Route = createFileRoute("/haulage")({
  head: () => ({
    meta: [
      { title: "CWC Summary and Haulage Generator" },
      {
        name: "description",
        content: "Freight train summaries, railway haulage calculations, Excel reports and local rake history.",
      },
      { property: "og:title", content: "CWC Summary and Haulage Generator" },
      {
        property: "og:description",
        content: "Freight train summaries, railway haulage calculations, Excel reports and local rake history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HaulageApp,
});
