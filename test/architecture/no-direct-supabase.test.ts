/**
 * no-direct-supabase.test.ts
 * -----------------------------------------------------------------------------
 * B5-BLK-5 — focused tests for the Zero-Direct-Supabase Guard.
 *
 * Two tiers:
 *   (1) Real-tree reconciliation against the frozen 243-entry baseline
 *       (read-only: reads the checked-in source + allowlist, never mutates).
 *   (2) Classification + ratchet-behavior tests driven entirely by IN-MEMORY
 *       fixtures (SourceFileInput arrays). No temp files, no repo mutation, no
 *       network, no database.
 *
 * Run: bun test test/architecture/no-direct-supabase.test.ts
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  assignIds,
  CATEGORIES,
  collectSourceFiles,
  EXPECTED_TOTALS,
  formatReport,
  inventorySupabaseSurface,
  isExemptPath,
  loadAllowlist,
  occurrenceKey,
  reconcile,
  REQUIRED_FIELDS,
  scanRepo,
  scanSource,
  validateAllowlistStructure,
  type AllowlistFile,
  type AllowlistOccurrence,
  type Inventory,
  type SourceFileInput,
} from "../../scripts/check-no-direct-supabase";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const ALLOWLIST_PATH = join(REPO_ROOT, "test", "architecture", "supabase-allowlist.json");

/** Helper: scan a set of in-memory fixture files. */
function scan(files: SourceFileInput[]) {
  return scanSource(files);
}

/** Helper: single-file fixture at an authored runtime path. */
function fixture(text: string, path = "src/lib/fixture.functions.ts"): SourceFileInput {
  return { path, text };
}

/** Helper: minimal AllowlistFile wrapper around a list of occurrences. */
function wrapAllowlist(occurrences: AllowlistOccurrence[]): AllowlistFile {
  return {
    contract: "test",
    blocker: "B5-BLK-5",
    repository: "test",
    baseCommit: "test",
    archiveSha256: "test",
    generatedBy: "test",
    note: "test",
    permanentPathExemptions: [],
    totals: {},
    occurrences,
  };
}

const EMPTY_INVENTORY: Inventory = {
  packageImports: [],
  integrationModuleImports: [],
  createClientCalls: [],
  envKeyReads: [],
  providerUrlLiterals: [],
  supabaseAdminReferences: [],
};

/* =========================================================================
 * Tier 1 — real-tree reconciliation against the frozen baseline.
 * ===================================================================== */

describe("baseline reconciliation (pinned tree)", () => {
  const treeOccurrences = scanRepo(REPO_ROOT);
  const allowlist = loadAllowlist(ALLOWLIST_PATH);

  test("1. reconciles exactly 243 direct SDK call sites on the pinned tree", () => {
    expect(treeOccurrences.length).toBe(243);
  });

  test("2. per-category census matches the required baseline (211/12/19/1/0/0)", () => {
    const byCategory: Record<string, number> = {};
    for (const c of CATEGORIES) byCategory[c] = 0;
    for (const o of treeOccurrences) byCategory[o.category] += 1;
    expect(byCategory.table).toBe(211);
    expect(byCategory.storage).toBe(12);
    expect(byCategory.auth).toBe(19);
    expect(byCategory.rpc).toBe(1);
    expect(byCategory.realtime).toBe(0);
    expect(byCategory.functions_invoke).toBe(0);
    expect(byCategory.other).toBe(0);
    expect(EXPECTED_TOTALS.total).toBe(243);
  });

  test("3. the tree matches the committed allowlist (guard passes, no drift)", () => {
    const rec = reconcile(treeOccurrences, allowlist.occurrences);
    expect(rec.unlisted).toEqual([]);
    expect(rec.orphaned).toEqual([]);
    expect(rec.ok).toBe(true);
  });

  test("4. allowlist holds exactly 243 entries with IDs 1..243, unique and complete", () => {
    expect(allowlist.occurrences.length).toBe(243);
    const structure = validateAllowlistStructure(allowlist);
    expect(structure.issues).toEqual([]);
    expect(structure.ok).toBe(true);
    const ids = allowlist.occurrences.map((o) => o.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(ids[242]).toBe(243);
    expect(new Set(ids).size).toBe(243);
  });

  test("5. every approved occurrence carries the full stable fingerprint", () => {
    for (const o of allowlist.occurrences) {
      for (const field of REQUIRED_FIELDS) {
        expect(field in o).toBe(true);
      }
      expect(typeof o.removalLane).toBe("string");
      expect(o.removalLane.length).toBeGreaterThan(0);
      expect(typeof o.removalCriterion).toBe("string");
      expect(o.removalCriterion.length).toBeGreaterThan(0);
    }
  });

  test("6. the single RPC occurrence targets fn_import_global_startup", () => {
    const rpc = allowlist.occurrences.filter((o) => o.category === "rpc");
    expect(rpc.length).toBe(1);
    expect(rpc[0].target).toBe("fn_import_global_startup");
  });
});

/* =========================================================================
 * Tier 2 — classification correctness (in-memory fixtures).
 * ===================================================================== */

describe("classification", () => {
  test("7. Array.from is ignored (not a Supabase base)", () => {
    const occ = scan([fixture("export const a = () => Array.from([1, 2, 3]);")]);
    expect(occ.length).toBe(0);
  });

  test("8. Buffer.from is ignored (not a Supabase base)", () => {
    const occ = scan([fixture('export const a = () => Buffer.from("hi", "utf8");')]);
    expect(occ.length).toBe(0);
  });

  test("9. storage.from is classified as storage, never as a table op", () => {
    const occ = scan([
      fixture('export const up = () => supabase.storage.from("bucket").upload("p", new Blob());'),
    ]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("storage");
    expect(occ[0].operation).toBe("storage.from");
    expect(occ[0].target).toBe("bucket");
    expect(occ.filter((o) => o.category === "table").length).toBe(0);
  });

  test("10. line comments and block comments are ignored", () => {
    const src = [
      "// supabase.from('deals').select('*');",
      "/* supabase.functions.invoke('fn'); supabase.auth.getSession(); */",
      "export const a = () => 1;",
    ].join("\n");
    expect(scan([fixture(src)]).length).toBe(0);
  });

  test("11. Supabase call sites inside string literals are ignored", () => {
    const occ = scan([fixture("export const s = \"supabase.from('deals')\";")]);
    expect(occ.length).toBe(0);
  });

  test("12. a table op is detected with its table-name target", () => {
    const occ = scan([fixture('export const a = () => supabase.from("deals").select("id");')]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("table");
    expect(occ[0].operation).toBe("from");
    expect(occ[0].target).toBe("deals");
    expect(occ[0].receiver).toBe("supabase");
  });

  test("13. auth member access is detected with its specific operation", () => {
    const occ = scan([fixture("export const a = async () => supabase.auth.getSession();")]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("auth");
    expect(occ[0].operation).toBe("auth.getSession");
  });

  test("14. supabaseAdmin is recognized as a Supabase client base", () => {
    const occ = scan([fixture('export const a = () => supabaseAdmin.from("users").select();')]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("table");
    expect(occ[0].receiver).toBe("supabaseAdmin");
  });

  test("15. a member-access base (context.supabase) is recognized", () => {
    const occ = scan([
      fixture('export const a = ({ context }) => context.supabase.from("deals").select();'),
    ]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("table");
    expect(occ[0].receiver).toBe("context.supabase");
  });

  test("16. a local createClient binding (aliased client) is recognized", () => {
    const src = [
      "import { createClient } from '@supabase/supabase-js';",
      "export function h() {",
      "  const sb = createClient(URL, KEY);",
      '  return sb.from("deals").select();',
      "}",
    ].join("\n");
    const occ = scan([fixture(src)]);
    const tables = occ.filter((o) => o.category === "table");
    expect(tables.length).toBe(1);
    expect(tables[0].receiver).toBe("sb");
  });

  test("17. realtime .channel is detectable (proves the baseline 0 is real, not blind)", () => {
    const occ = scan([fixture('export const a = () => supabase.channel("room").subscribe();')]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("realtime");
  });

  test("18. functions.invoke is detectable (proves the baseline 0 is a comment, not blind)", () => {
    const occ = scan([fixture('export const a = () => supabase.functions.invoke("fn");')]);
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("functions_invoke");
    expect(occ[0].operation).toBe("functions.invoke");
  });

  test("19. a .from on a non-Supabase receiver is ignored", () => {
    const occ = scan([fixture('export const a = (qb) => qb.from("deals").where("x");')]);
    expect(occ.length).toBe(0);
  });

  test("20. repeated identical calls in one symbol get distinct ordinals", () => {
    const src = [
      "export const a = async () => {",
      '  await supabase.from("deals").insert({});',
      '  await supabase.from("deals").insert({});',
      "};",
    ].join("\n");
    const occ = scan([fixture(src)]);
    expect(occ.length).toBe(2);
    expect(occ.map((o) => o.ordinal).sort()).toEqual([0, 1]);
    expect(occurrenceKey(occ[0])).not.toBe(occurrenceKey(occ[1]));
  });
});

/* =========================================================================
 * Tier 2 — bounded exemptions.
 * ===================================================================== */

describe("permanent path exemptions (bounded)", () => {
  const call = 'export const a = () => supabase.from("deals").select();';

  test("21. the three permanent exemptions suppress detection", () => {
    expect(scan([fixture(call, "src/routeTree.gen.ts")]).length).toBe(0);
    expect(scan([fixture(call, "src/integrations/supabase/types.ts")]).length).toBe(0);
    expect(scan([fixture(call, "supabase/migrations/0001_init.ts")]).length).toBe(0);
    expect(isExemptPath("src/routeTree.gen.ts")).toBe(true);
    expect(isExemptPath("src/integrations/supabase/types.ts")).toBe(true);
    expect(isExemptPath("supabase/migrations/anything/deep.ts")).toBe(true);
  });

  test("22. exemptions are bounded — sibling authored files are NOT exempt", () => {
    // A different file in the same integration folder is still scanned.
    expect(scan([fixture(call, "src/integrations/supabase/client-helpers.ts")]).length).toBe(1);
    // routeTree.gen.ts is exempt, but routeTree.ts (authored) is not.
    expect(scan([fixture(call, "src/routeTree.ts")]).length).toBe(1);
    // A normal authored file is scanned.
    expect(scan([fixture(call, "src/lib/deals.functions.ts")]).length).toBe(1);
    expect(isExemptPath("src/integrations/supabase/client.ts")).toBe(false);
    expect(isExemptPath("src/lib/deals.functions.ts")).toBe(false);
  });
});

/* =========================================================================
 * Tier 2 — ratchet behavior (add rejected, aligned removal accepted).
 * ===================================================================== */

describe("ratchet behavior", () => {
  const V1 = 'export const a = () => supabase.from("deals").select();';

  test("23. a NEW call added inside an already-allowlisted file is rejected", () => {
    const path = "src/lib/deals.functions.ts";
    const allow = assignIds(scan([fixture(V1, path)]));
    const v2 =
      'export const a = () => {\n  supabase.from("deals").select();\n  supabase.from("startups").select();\n};';
    const rec = reconcile(scan([fixture(v2, path)]), allow);
    expect(rec.ok).toBe(false);
    expect(rec.unlisted.length).toBe(1);
    expect(rec.unlisted[0].target).toBe("startups");
  });

  test("24. a NEW call in a brand-new file is rejected", () => {
    const allow = assignIds(scan([fixture(V1, "src/lib/deals.functions.ts")]));
    const rec = reconcile(
      scan([
        fixture(V1, "src/lib/deals.functions.ts"),
        fixture(
          'export const b = () => supabase.from("investors").select();',
          "src/lib/new.functions.ts",
        ),
      ]),
      allow,
    );
    expect(rec.ok).toBe(false);
    expect(rec.unlisted.length).toBe(1);
    expect(rec.unlisted[0].path).toBe("src/lib/new.functions.ts");
  });

  test("25. growing the allowlist with an entry that has no source occurrence is rejected", () => {
    const path = "src/lib/deals.functions.ts";
    const allow = assignIds(scan([fixture(V1, path)]));
    const forged: AllowlistOccurrence = {
      id: 999,
      path,
      category: "table",
      receiver: "supabase",
      operation: "from",
      target: "ghost_table",
      enclosingSymbol: "a",
      ordinal: 0,
      line: 1,
      removalLane: "deals",
      removalCriterion: "forged",
    };
    const rec = reconcile(scan([fixture(V1, path)]), [...allow, forged]);
    expect(rec.ok).toBe(false);
    expect(rec.orphaned.length).toBe(1);
    expect(rec.orphaned[0].target).toBe("ghost_table");
  });

  test("26. deleting code but leaving its allowlist entry is rejected", () => {
    const path = "src/lib/deals.functions.ts";
    const v1 =
      'export const a = () => {\n  supabase.from("deals").select();\n  supabase.from("startups").select();\n};';
    const allow = assignIds(scan([fixture(v1, path)]));
    expect(allow.length).toBe(2);
    // Source now only has the "deals" call; the "startups" allowlist row is stale.
    const rec = reconcile(scan([fixture(V1, path)]), allow);
    expect(rec.ok).toBe(false);
    expect(rec.orphaned.length).toBe(1);
    expect(rec.orphaned[0].target).toBe("startups");
  });

  test("27. deleting code AND its allowlist entry together is accepted (ratchet shrinks)", () => {
    const path = "src/lib/deals.functions.ts";
    const v1 =
      'export const a = () => {\n  supabase.from("deals").select();\n  supabase.from("startups").select();\n};';
    const allow = assignIds(scan([fixture(v1, path)]));
    const reduced = allow.filter((e) => e.target !== "startups");
    expect(reduced.length).toBe(1);
    const rec = reconcile(scan([fixture(V1, path)]), reduced);
    expect(rec.unlisted).toEqual([]);
    expect(rec.orphaned).toEqual([]);
    expect(rec.ok).toBe(true);
  });

  test("28. source line is reporting-only — line shifts do not break matching", () => {
    const path = "src/lib/deals.functions.ts";
    const v1 = 'export const a = () => {\n  supabase.from("deals").select();\n};';
    const allow = assignIds(scan([fixture(v1, path)]));
    const shifted = "\n\n\n\n" + v1; // push the call four lines down
    const rescan = scan([fixture(shifted, path)]);
    expect(rescan[0].line).not.toBe(allow[0].line);
    const rec = reconcile(rescan, allow);
    expect(rec.ok).toBe(true);
  });
});

/* =========================================================================
 * Tier 2 — failure output, structure validation, inventory.
 * ===================================================================== */

describe("reporting, structure, and inventory", () => {
  test("29. failure output clearly names the offending file, line, and category", () => {
    const path = "src/lib/new.functions.ts";
    const scanResult = scan([
      fixture('export const a = () => supabase.from("deals").select();', path),
    ]);
    const rec = reconcile(scanResult, []); // empty allowlist -> everything is unlisted
    const report = formatReport(
      scanResult,
      wrapAllowlist([]),
      rec,
      { ok: true, issues: [] },
      EMPTY_INVENTORY,
    );
    expect(report).toContain("FAIL");
    expect(report).toContain(path);
    expect(report).toContain("table");
    expect(report).toContain("from");
  });

  test("30. structure validation rejects a duplicate ID", () => {
    const base = assignIds(
      scan([fixture('export const a = () => supabase.from("deals").select();')]),
    );
    const dup: AllowlistOccurrence = {
      ...base[0],
      id: base[0].id,
      target: "startups",
      enclosingSymbol: "b",
    };
    const result = validateAllowlistStructure(wrapAllowlist([base[0], dup]));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("duplicate id"))).toBe(true);
  });

  test("31. structure validation rejects a missing required field", () => {
    const base = assignIds(
      scan([fixture('export const a = () => supabase.from("deals").select();')]),
    );
    const broken = { ...base[0] } as Partial<AllowlistOccurrence>;
    delete broken.removalCriterion;
    const result = validateAllowlistStructure(wrapAllowlist([broken as AllowlistOccurrence]));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("removalCriterion"))).toBe(true);
  });

  test("32. the Supabase-surface inventory finds the known integration points on the tree", () => {
    const inv = inventorySupabaseSurface(collectSourceFiles(REPO_ROOT));
    expect(inv.packageImports.length).toBe(3);
    expect(inv.createClientCalls.length).toBe(3);
    expect(inv.providerUrlLiterals.length).toBe(0);
    expect(inv.supabaseAdminReferences.length).toBeGreaterThan(0);
    expect(inv.integrationModuleImports.length).toBeGreaterThan(0);
  });
});
