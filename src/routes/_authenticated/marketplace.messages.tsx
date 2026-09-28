import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/marketplace/messages")({
  head: () => ({
    meta: [
      { title: "Messages — PitchSnack" },
      { name: "description", content: "Messages with buyers, sellers and advisors on PitchSnack." },
      { property: "og:title", content: "Messages — PitchSnack" },
      { property: "og:description", content: "Messages with buyers, sellers and advisors on PitchSnack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">Messaging is coming soon.</p>
    </div>
  ),
});
