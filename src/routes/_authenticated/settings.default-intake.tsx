import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/default-intake")({
  beforeLoad: () => {
    throw redirect({ to: "/users" });
  },
});
