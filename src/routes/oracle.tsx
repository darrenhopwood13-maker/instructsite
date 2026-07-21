import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/oracle")({
  beforeLoad: () => {
    throw redirect({ to: "/tooling" });
  },
});
