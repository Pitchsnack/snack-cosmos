/** After "Yes" on + Add: make the draft, save the answers, refresh the role's company list, then open My Company on the new draft. */
export type AddKind = "seller" | "buyer" | "advisor";
export const ADD_LIST_KEYS: Record<AddKind, readonly unknown[]> = {
  seller: ["startups"],
  buyer: ["buyer-investor", "ids"],
  advisor: ["advisor-firms", "mine"],
};
export const ADD_RETURN: Record<AddKind, { to: "/my-startups" | "/marketplace/my-company" }> = {
  seller: { to: "/my-startups" },
  buyer: { to: "/marketplace/my-company" },
  advisor: { to: "/marketplace/my-company" },
};
export async function finishAddYes(kind: AddKind, deps: {
  create: () => Promise<{ id: string }>;
  apply: (id: string) => Promise<unknown>;
  refresh: (key: readonly unknown[]) => Promise<unknown>;
  close: () => void;
  go: (to: string, search: { open: string }) => Promise<unknown>;
}) {
  const { id } = await deps.create();
  await deps.apply(id);
  // The list must contain the new draft before My Company tries to select it.
  await deps.refresh(ADD_LIST_KEYS[kind]);
  deps.close();
  await deps.go(ADD_RETURN[kind].to, { open: id });
  return id;
}
