/**
 * Share flow contact source — FRONTEND ONLY.
 *
 * The Share flow must search the *user's own Contacts*, never the full
 * SnackPortal2 member directory (PRD §3, §20). No backend contact-share
 * contract exists yet, so this module exposes a session-local demo contact
 * book behind a single accessor. Swapping in a real adapter later only
 * requires replacing `listShareContacts`.
 */

export type ShareContactType = "Investor" | "Startup" | "VC" | "Group" | "Other";

export interface ShareContact {
  id: string;
  name: string;
  position?: string;
  organisation?: string;
  email: string;
  type: ShareContactType;
  connected: boolean;
  frequent?: boolean;
  tags?: string[];
}

const CONTACTS: ShareContact[] = [
  {
    id: "sc1",
    name: "Sarah Chen",
    position: "Partner",
    organisation: "Horizon Ventures",
    email: "sarah.chen@horizonvc.com",
    type: "Investor",
    connected: true,
    frequent: true,
    tags: ["Seed", "SaaS"],
  },
  {
    id: "sc2",
    name: "Alex Rivera",
    position: "Principal",
    organisation: "NextWave VC",
    email: "alex.rivera@nextwave.vc",
    type: "Investor",
    connected: true,
    frequent: true,
    tags: ["Series A"],
  },
  {
    id: "sc3",
    name: "Michael Thompson",
    position: "Managing Partner",
    organisation: "TechCap",
    email: "michael@techcap.com",
    type: "VC",
    connected: true,
    frequent: true,
    tags: ["Growth"],
  },
  {
    id: "sc4",
    name: "TechNova Solutions",
    position: "SaaS Startup",
    organisation: "TechNova",
    email: "hello@technova.io",
    type: "Startup",
    connected: false,
    frequent: true,
  },
  {
    id: "sc5",
    name: "Jessica Park",
    position: "Investment Director",
    organisation: "Elevate VC",
    email: "j.park@elevate.vc",
    type: "Investor",
    connected: true,
    frequent: true,
  },
  {
    id: "sc6",
    name: "Product Founders Network",
    position: "Community Group",
    organisation: "PFN",
    email: "intro@foundersnetwork.org",
    type: "Group",
    connected: false,
    frequent: true,
  },
  {
    id: "sc7",
    name: "Emily Chen",
    position: "VP of Marketing",
    organisation: "SnackMagic",
    email: "emily.chen@snackmagic.com",
    type: "Other",
    connected: true,
  },
  {
    id: "sc8",
    name: "David Wilson",
    position: "Partner",
    organisation: "Growth Fund",
    email: "david.wilson@growthfund.com",
    type: "VC",
    connected: false,
  },
  {
    id: "sc9",
    name: "Emma Laurent",
    position: "Associate",
    organisation: "Innovate VC",
    email: "emma@innovate.vc",
    type: "Investor",
    connected: false,
  },
  {
    id: "sc10",
    name: "Michael Patel",
    position: "Founder & CEO",
    organisation: "Nourish Co.",
    email: "michael@nourish.co",
    type: "Startup",
    connected: true,
  },
];

export const SHARE_CONTACT_FILTERS = [
  "All Contacts",
  "Investors",
  "Startups",
  "VCs / Funds",
  "Groups",
  "Other",
] as const;

export type ShareContactFilter = (typeof SHARE_CONTACT_FILTERS)[number];

/** The user's own contacts. Never the platform member directory. */
export function listShareContacts(): ShareContact[] {
  return CONTACTS;
}

function matchesFilter(c: ShareContact, filter: ShareContactFilter) {
  switch (filter) {
    case "Investors":
      return c.type === "Investor";
    case "Startups":
      return c.type === "Startup";
    case "VCs / Funds":
      return c.type === "VC";
    case "Groups":
      return c.type === "Group";
    case "Other":
      return c.type === "Other";
    default:
      return true;
  }
}

export function searchShareContacts(
  query: string,
  filter: ShareContactFilter = "All Contacts",
): ShareContact[] {
  const q = query.trim().toLowerCase();
  return listShareContacts().filter((c) => {
    if (!matchesFilter(c, filter)) return false;
    if (!q) return true;
    return [c.name, c.organisation, c.email, c.position, ...(c.tags ?? [])]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
