import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage, adminContactsQuery } from "@/components/contacts/admin-contacts-page";

const description = "PitchSnack Admin directory of buyers, sellers and advisors with private contact notes.";
export const Route = createFileRoute("/_authenticated/contacts/")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(adminContactsQuery); },
  head: () => ({ meta: [
    { title: "Admin My Contacts — PitchSnack" },
    { name: "description", content: description },
    { property: "og:title", content: "Admin My Contacts — PitchSnack" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ContactsPage,
});
