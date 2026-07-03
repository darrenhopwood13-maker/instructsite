import { createFileRoute } from "@tanstack/react-router";
import OraclePage from "@/pages/Oracle";

export const Route = createFileRoute("/oracle")({
  head: () => ({
    meta: [
      { title: "Oracle" },
      { name: "description", content: "Oracle tooling for AI-powered site operations." },
    ],
  }),
  component: OraclePage,
});
