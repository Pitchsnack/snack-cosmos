import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

/** Old links: + Add My Business now makes a Draft and opens its wizard. This page never creates a business. */
export const Route = createFileRoute("/_authenticated/my-startups/new")({
  head: () => ({
    meta: [
      { title: "Add My Business — PitchSnack" },
      { name: "description", content: "Add a business from My Company." },
    ],
  }),
  component: Redirect,
});

function Redirect() {
  const navigate = useNavigate();
  useEffect(() => { void navigate({ to: "/my-startups", replace: true }); }, [navigate]);
  return null;
}
