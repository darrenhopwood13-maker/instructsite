import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/organisation")({
  beforeLoad: () => {
    throw redirect({ to: "/org" });
  },
});
