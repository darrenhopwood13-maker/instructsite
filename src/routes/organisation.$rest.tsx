import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/organisation/$rest")({
  beforeLoad: () => {
    throw redirect({ to: "/org" });
  },
});
