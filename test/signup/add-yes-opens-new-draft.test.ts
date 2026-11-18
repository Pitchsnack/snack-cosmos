import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { finishAddYes, ADD_LIST_KEYS, type AddKind } from "@/lib/add-company-finish";

// An account that already has one company; the server list gains the new draft once refetched.
async function run(kind: AddKind) {
  const qc = new QueryClient();
  const server = ["existing-company"];
  const key = kind === "seller" ? ["startups", "list", {}] : [...ADD_LIST_KEYS[kind]];
  await qc.fetchQuery({ queryKey: key, queryFn: () => [...server], staleTime: Infinity });
  qc.getQueryCache().build(qc, { queryKey: key, queryFn: () => [...server] });
  const obs = qc.getQueryCache().find({ queryKey: key })!;
  const unsub = obs.subscribe?.(() => {}) as unknown as (() => void) | undefined;
  let listAtOpen: string[] | undefined; let opened: { to: string; open: string } | undefined; let closed = false;
  const id = await finishAddYes(kind, {
    create: async () => ({ id: "new-draft" }),
    apply: async (nid) => { server.push(nid); },
    refresh: (k) => qc.invalidateQueries({ queryKey: [...k], refetchType: "all" }),
    close: () => { closed = true; },
    go: async (to, search) => { listAtOpen = qc.getQueryData<string[]>(key); opened = { to, open: search.open }; },
  });
  unsub?.();
  return { id, listAtOpen, opened, closed };
}

describe("+ Add → Yes on an account that already has a company opens the new draft", () => {
  it("seller: My Company list holds the new draft when it opens", async () => {
    const r = await run("seller");
    expect(r.listAtOpen).toEqual(["existing-company", "new-draft"]);
    expect(r.opened).toEqual({ to: "/my-startups", open: "new-draft" });
    expect(r.closed).toBe(true);
  });
  it("buyer: investor profile list holds the new draft when it opens", async () => {
    const r = await run("buyer");
    expect(r.listAtOpen).toEqual(["existing-company", "new-draft"]);
    expect(r.opened).toEqual({ to: "/marketplace/my-company", open: "new-draft" });
  });
  it("advisor: firm list holds the new draft when it opens", async () => {
    const r = await run("advisor");
    expect(r.listAtOpen).toEqual(["existing-company", "new-draft"]);
    expect(r.opened).toEqual({ to: "/marketplace/my-company", open: "new-draft" });
  });
});
