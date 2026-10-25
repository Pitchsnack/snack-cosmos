/** UI validation only; the existing server validators remain authoritative. */
export function missingCreationFields(kind: "startup" | "investor" | "advisor", name: string, tenant = "", owner = "", aiOwner = "") {
  const missing: string[] = [];
  if (!name.trim()) missing.push(kind === "advisor" ? "Firm name" : "Company Name");
  if (kind !== "advisor") {
    if (!tenant) missing.push("Tenant");
    if (!owner) missing.push("Owning Agent");
    if (!aiOwner) missing.push("Owning AI Agent");
  }
  return missing;
}

/** Retain notes/metadata on unchanged portfolio holdings when editing names. */
export function preservePortfolioEntries(names: string[], existing: unknown) {
  const rows = Array.isArray(existing) ? existing : [];
  return names.map((name) => rows.find((row) => row && typeof row === "object" && row.name === name) ?? {name, note: ""});
}