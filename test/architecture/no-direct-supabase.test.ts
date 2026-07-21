/**
 * no-direct-supabase.test.ts
 * -----------------------------------------------------------------------------
 * B5-BLK-5 — focused tests for the Zero-Direct-Supabase Guard.
 *
 * Two tiers:
 *   (1) Real-tree reconciliation against the frozen 243-direct / 55-dependency
 *       baseline (read-only: reads the checked-in source + allowlist, never
 *       mutates).
 *   (2) Classification, exemption, ratchet, structure, and reporting tests
 *       driven entirely by IN-MEMORY fixtures (SourceFileInput arrays). No temp
 *       files, no repo mutation, no network, no database.
 *
 * Run: bun test test/architecture/no-direct-supabase.test.ts
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAllowlist,
  compareRatchet,
  DIRECT_CATEGORIES,
  DIRECT_REQUIRED_FIELDS,
  directKey,
  EXPECTED_DIRECT_TOTALS,
  formatReport,
  loadAllowlist,
  reconcile,
  scanDependencies,
  scanDirect,
  scanRepo,
  validateStructure,
  type Allowlist,
  type ScanResult,
  type SourceFileInput,
} from "../../scripts/check-no-direct-supabase";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const ALLOWLIST_PATH = join(REPO_ROOT, "test", "architecture", "supabase-allowlist.json");

function fixture(text: string, path = "src/lib/fixture.functions.ts"): SourceFileInput {
  return { path, text };
}

function scanD(text: string, path?: string) {
  return scanDirect([fixture(text, path)]);
}

function scanFiles(files: SourceFileInput[]): ScanResult {
  return { direct: scanDirect(files), dependency: scanDependencies(files) };
}

function allowFrom(files: SourceFileInput[]): Allowlist {
  return buildAllowlist(scanFiles(files));
}

/* =========================================================================
 * Tier 1 — real-tree reconciliation against the frozen baseline.
 * ===================================================================== */

describe("baseline reconciliation (pinned tree)", () => {
  const scan = scanRepo(REPO_ROOT);
  const allow = loadAllowlist(ALLOWLIST_PATH);
  const byCategory: Record<string, number> = {};
  for (const c of DIRECT_CATEGORIES) byCategory[c] = 0;
  for (const o of scan.direct) byCategory[o.category] += 1;

  test("1. accepted source reproduces 211 table calls", () => {
    expect(byCategory.table).toBe(211);
  });
  test("2. accepted source reproduces 12 storage calls", () => {
    expect(byCategory.storage).toBe(12);
  });
  test("3. accepted source reproduces 1 RPC call", () => {
    expect(byCategory.rpc).toBe(1);
    expect(scan.direct.filter((o) => o.category === "rpc")[0].target).toBe(
      "fn_import_global_startup",
    );
  });
  test("4. accepted source reproduces 19 auth calls", () => {
    expect(byCategory.auth).toBe(19);
  });
  test("5. accepted source reproduces 0 realtime calls", () => {
    expect(byCategory.realtime).toBe(0);
  });
  test("6. accepted source reproduces 0 real functions.invoke calls", () => {
    expect(byCategory.functions_invoke).toBe(0);
  });
  test("7. total direct SDK calls = 243", () => {
    expect(scan.direct.length).toBe(243);
    expect(EXPECTED_DIRECT_TOTALS.total).toBe(243);
  });
  test("8. IDs 1-243 are unique and complete; structure is valid", () => {
    const structure = validateStructure(allow);
    expect(structure.issues).toEqual([]);
    expect(structure.ok).toBe(true);
    const ids = allow.direct.map((o) => o.id).sort((a, b) => (a as number) - (b as number));
    expect(ids[0]).toBe(1);
    expect(ids[242]).toBe(243);
    expect(new Set(ids).size).toBe(243);
    expect(allow.activeDirectIds.length).toBe(243);
  });
  test("9. no detected occurrence is outside the active allowlist", () => {
    const rec = reconcile(scan, allow);
    expect(rec.directUnlisted).toEqual([]);
    expect(rec.dependencyUnlisted).toEqual([]);
  });
  test("10. no active entry is orphaned", () => {
    const rec = reconcile(scan, allow);
    expect(rec.directOrphaned).toEqual([]);
    expect(rec.dependencyOrphaned).toEqual([]);
    expect(rec.ok).toBe(true);
  });
  test("10b. dependency baseline reconciles (55 entries, active complete)", () => {
    expect(scan.dependency.length).toBe(55);
    expect(allow.dependency.length).toBe(55);
    expect(allow.activeDependencyIds.length).toBe(55);
  });
  test("10c. every approved direct occurrence carries the full fingerprint", () => {
    for (const raw of loadRaw().direct_sdk_baseline.occurrences) {
      for (const field of DIRECT_REQUIRED_FIELDS) expect(field in raw).toBe(true);
    }
  });
});

function loadRaw(): {
  direct_sdk_baseline: { occurrences: Record<string, unknown>[] };
} {
  return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
}

/* =========================================================================
 * Tier 2 — classification (in-memory fixtures).
 * ===================================================================== */

describe("classification", () => {
  test("11. Array.from is ignored", () => {
    expect(scanD("export const a = () => Array.from([1, 2, 3]);").length).toBe(0);
  });
  test("12. Buffer.from is ignored", () => {
    expect(scanD('export const a = () => Buffer.from("hi", "utf8");').length).toBe(0);
  });
  test("13. storage.from is storage, not table", () => {
    const occ = scanD('export const up = () => supabase.storage.from("bucket").upload("p", x);');
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("storage");
    expect(occ[0].operation).toBe("storage.from");
    expect(occ[0].target).toBe("bucket");
    expect(occ.filter((o) => o.category === "table").length).toBe(0);
  });
  test("14. comment mentioning supabase.from is ignored", () => {
    expect(scanD("// supabase.from('deals').select();\nexport const a = () => 1;").length).toBe(0);
  });
  test("15. comment mentioning functions.invoke is ignored", () => {
    const src =
      "/* supabase.functions.invoke('fn'); supabase.auth.getSession(); */\nexport const a = 1;";
    expect(scanD(src).length).toBe(0);
  });
  test("15b. Supabase call sites inside string literals are ignored", () => {
    expect(scanD("export const s = \"supabase.from('deals')\";").length).toBe(0);
  });
  test("15c. a table op is detected with its table-name target", () => {
    const occ = scanD('export const a = () => supabase.from("deals").select("id");');
    expect(occ[0].category).toBe("table");
    expect(occ[0].operation).toBe("from");
    expect(occ[0].target).toBe("deals");
    expect(occ[0].receiver).toBe("supabase");
  });
  test("15d. auth is detected with its specific operation (not realtime)", () => {
    const occ = scanD("export const a = () => supabase.auth.onAuthStateChange(cb);");
    expect(occ.length).toBe(1);
    expect(occ[0].category).toBe("auth");
    expect(occ[0].operation).toBe("auth.onAuthStateChange");
  });
  test("15e. supabaseAdmin is recognized as a client base", () => {
    const occ = scanD('export const a = () => supabaseAdmin.from("users").select();');
    expect(occ[0].category).toBe("table");
    expect(occ[0].receiver).toBe("supabaseAdmin");
  });
  test("15f. context.supabase (member base) is recognized", () => {
    const occ = scanD('export const a = ({ context }) => context.supabase.from("deals").select();');
    expect(occ[0].receiver).toBe("context.supabase");
  });
  test("15g. a local createClient binding is recognized", () => {
    const src =
      "import { createClient } from '@supabase/supabase-js';\n" +
      'export function h() {\n  const sb = createClient(U, K);\n  return sb.from("deals").select();\n}';
    const occ = scanDirect([fixture(src)]).filter((o) => o.category === "table");
    expect(occ.length).toBe(1);
    expect(occ[0].receiver).toBe("sb");
  });
  test("15h. realtime .channel is detectable (proves the baseline 0 is real)", () => {
    const occ = scanD('export const a = () => supabase.channel("room").subscribe();');
    expect(occ[0].category).toBe("realtime");
  });
  test("15i. functions.invoke is detectable (proves the baseline 0 is a comment)", () => {
    const occ = scanD('export const a = () => supabase.functions.invoke("fn");');
    expect(occ[0].category).toBe("functions_invoke");
    expect(occ[0].operation).toBe("functions.invoke");
  });
  test("15j. a .from on a non-Supabase receiver is ignored", () => {
    expect(scanD('export const a = (qb) => qb.from("deals").where("x");').length).toBe(0);
  });
  test("15k. repeated identical calls in one symbol get distinct ordinals", () => {
    const src =
      'export const a = () => {\n  supabase.from("deals").insert({});\n  supabase.from("deals").insert({});\n};';
    const occ = scanD(src);
    expect(occ.length).toBe(2);
    expect(occ.map((o) => o.ordinal).sort()).toEqual([0, 1]);
    expect(directKey(occ[0])).not.toBe(directKey(occ[1]));
  });
});

/* =========================================================================
 * Tier 2 — bounded exemptions.
 * ===================================================================== */

describe("permanent path exemptions (bounded)", () => {
  const call = 'export const a = () => supabase.from("deals").select();';
  test("21. generated-file exemptions are bounded", () => {
    expect(scanD(call, "src/routeTree.gen.ts").length).toBe(0);
    expect(scanD(call, "src/integrations/supabase/types.ts").length).toBe(0);
    // A sibling authored file in the same folder is NOT exempt.
    expect(scanD(call, "src/integrations/supabase/client-helpers.ts").length).toBe(1);
    // routeTree.gen.ts is exempt, routeTree.ts is not.
    expect(scanD(call, "src/routeTree.ts").length).toBe(1);
  });
  test("22. migration exemption is bounded", () => {
    expect(scanD(call, "supabase/migrations/0001_init.ts").length).toBe(0);
    expect(scanD(call, "supabase/migrations/deep/x.ts").length).toBe(0);
    // A non-migration authored file is scanned.
    expect(scanD(call, "src/lib/deals.functions.ts").length).toBe(1);
  });
});

/* =========================================================================
 * Tier 2 — ratchet, bootstrap, and structure.
 * ===================================================================== */

describe("ratchet and bootstrap", () => {
  const V1 = 'export const a = () => supabase.from("deals").select();';
  const P = "src/lib/deals.functions.ts";

  test("16. a new direct call in an already-allowlisted file is rejected", () => {
    const allow = allowFrom([fixture(V1, P)]);
    const v2 =
      'export const a = () => {\n  supabase.from("deals").select();\n  supabase.from("startups").select();\n};';
    const rec = reconcile(scanFiles([fixture(v2, P)]), allow);
    expect(rec.ok).toBe(false);
    expect(rec.directUnlisted.length).toBe(1);
    expect(rec.directUnlisted[0].target).toBe("startups");
  });

  test("17. a new call in a new file is rejected", () => {
    const allow = allowFrom([fixture(V1, P)]);
    const rec = reconcile(
      scanFiles([
        fixture(V1, P),
        fixture(
          'export const b = () => supabase.from("investors").select();',
          "src/lib/new.functions.ts",
        ),
      ]),
      allow,
    );
    expect(rec.ok).toBe(false);
    expect(rec.directUnlisted[0].path).toBe("src/lib/new.functions.ts");
  });

  test("18. an allowlist addition relative to the base is rejected", () => {
    const base = allowFrom([fixture(V1, P)]); // active [1]
    const v2 =
      'export const a = () => {\n  supabase.from("deals").select();\n  supabase.from("startups").select();\n};';
    const head = allowFrom([fixture(v2, P)]); // active [1,2]
    const ratchet = compareRatchet(base, head);
    expect(ratchet.bootstrap).toBe(false);
    expect(ratchet.ok).toBe(false);
    expect(ratchet.issues.some((i) => i.includes("ADDED"))).toBe(true);
  });

  test("19. an allowlist deletion without code deletion is rejected", () => {
    // The allowlist entry was removed (active empty) but the code still exists.
    const emptyAllow: Allowlist = { ...allowFrom([]), sourceCommit: allowFrom([]).sourceCommit };
    const rec = reconcile(scanFiles([fixture(V1, P)]), emptyAllow);
    expect(rec.ok).toBe(false);
    expect(rec.directUnlisted.length).toBe(1);
  });

  test("20. an occurrence deletion plus active-ID removal is accepted", () => {
    const v1 =
      'export const a = () => {\n  supabase.from("deals").select();\n  supabase.from("startups").select();\n};';
    const allow = allowFrom([fixture(v1, P)]); // 2 entries
    // Remove the "startups" occurrence AND its active entry together.
    const startupsId = allow.direct.find((o) => o.target === "startups")!.id as number;
    const reduced: Allowlist = {
      ...allow,
      direct: allow.direct.filter((o) => o.id !== startupsId),
      activeDirectIds: allow.activeDirectIds.filter((id) => id !== startupsId),
    };
    const rec = reconcile(scanFiles([fixture(V1, P)]), reduced);
    expect(rec.directUnlisted).toEqual([]);
    expect(rec.directOrphaned).toEqual([]);
    expect(rec.ok).toBe(true);
  });

  test("20b. bootstrap is accepted when the base has no allowlist and census is exact", () => {
    const head = loadAllowlist(ALLOWLIST_PATH);
    const ratchet = compareRatchet(null, head);
    expect(ratchet.bootstrap).toBe(true);
    expect(ratchet.ok).toBe(true);
  });

  test("20c. bootstrap is rejected when the census is not exactly 243", () => {
    const head = allowFrom([fixture(V1, P)]); // total 1
    const ratchet = compareRatchet(null, head);
    expect(ratchet.bootstrap).toBe(true);
    expect(ratchet.ok).toBe(false);
  });

  test("20d. structure validation rejects a duplicate id", () => {
    const allow = loadAllowlist(ALLOWLIST_PATH);
    const broken: Allowlist = {
      ...allow,
      direct: [{ ...allow.direct[0], id: allow.direct[1].id }, ...allow.direct.slice(1)],
    };
    const result = validateStructure(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("duplicate id"))).toBe(true);
  });

  test("20e. structure validation rejects a wrong owner", () => {
    const allow = loadAllowlist(ALLOWLIST_PATH);
    const result = validateStructure({ ...allow, owner: "someone-else" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("owner"))).toBe(true);
  });
});

/* =========================================================================
 * Tier 2 — reporting + dependency + no-runtime-dependency.
 * ===================================================================== */

describe("reporting, dependency inventory, and self-scan", () => {
  test("23. failure output includes path, line, category, and fingerprint", () => {
    const scan = scanFiles([
      fixture(
        'export const a = () => supabase.from("deals").select();',
        "src/lib/new.functions.ts",
      ),
    ]);
    const empty = buildAllowlist({ direct: [], dependency: [] });
    const rec = reconcile(scan, empty);
    const report = formatReport(scan, empty, { ok: true, issues: [] }, rec);
    expect(report).toContain("FAIL");
    expect(report).toContain("src/lib/new.functions.ts:1");
    expect(report).toContain("[table]");
    expect(report).toContain("supabase.from");
    expect(report).toContain('"deals"');
    expect(report).toContain("#0");
  });

  test("24. the scanner and tests introduce no runtime Supabase dependency", () => {
    const scannerText = readFileSync(
      join(REPO_ROOT, "scripts", "check-no-direct-supabase.ts"),
      "utf8",
    );
    const testText = readFileSync(
      join(REPO_ROOT, "test", "architecture", "no-direct-supabase.test.ts"),
      "utf8",
    );
    const files: SourceFileInput[] = [
      { path: "scripts/check-no-direct-supabase.ts", text: scannerText },
      { path: "test/architecture/no-direct-supabase.test.ts", text: testText },
    ];
    // No direct SDK call sites in the guard's own code.
    expect(scanDirect(files).length).toBe(0);
    // No runtime Supabase imports / createClient calls in the guard's own code.
    const deps = scanDependencies(files);
    expect(deps.filter((d) => d.category === "package_import").length).toBe(0);
    expect(deps.filter((d) => d.category === "integration_module_import").length).toBe(0);
    expect(deps.filter((d) => d.category === "create_client_call").length).toBe(0);
  });

  test("24b. the dependency inventory finds the known integration points on the tree", () => {
    const scan = scanRepo(REPO_ROOT);
    const byCategory: Record<string, number> = {};
    for (const d of scan.dependency) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
    expect(byCategory.package_import).toBe(3);
    expect(byCategory.create_client_call).toBe(3);
    expect(byCategory.provider_url_literal ?? 0).toBe(0);
    expect(byCategory.supabase_admin_reference).toBeGreaterThan(0);
    expect(byCategory.integration_module_import).toBeGreaterThan(0);
  });
});
