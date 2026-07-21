/**
 * check-no-direct-supabase.ts
 * -----------------------------------------------------------------------------
 * B5-BLK-5 — Zero-Direct-Supabase Guard (scaffold, read-only).
 *
 * Purpose
 *   Freeze the current inventory of direct `@supabase/supabase-js` SDK call
 *   sites in the Lovable frontend as a fixed baseline, and fail whenever a new
 *   direct call is added or an approved occurrence is removed without also
 *   removing its allowlist entry. This is a *ratchet*: the baseline may only
 *   shrink (as call sites are re-pointed at the API Gateway during cutover),
 *   never grow.
 *
 * Scope / boundary
 *   This module is a static analyzer only. It never opens a network socket,
 *   never contacts Supabase, never touches auth / storage / RLS / a database /
 *   the Gateway runtime. It parses TypeScript/TSX with the TypeScript compiler
 *   API (syntactic AST only — no type-checker, no program) and reports.
 *
 * Classification
 *   A "direct SDK call site" is a property access whose immediate receiver is a
 *   Supabase client base (`supabase`, `supabaseAdmin`, `<expr>.supabase`, or a
 *   local `createClient(...)` binding). The property accessed on the base is the
 *   category anchor:
 *     .from   -> table            .storage -> storage       .auth -> auth
 *     .rpc    -> rpc              .channel / .removeChannel / .removeAllChannels
 *                                 / .getChannels / .realtime -> realtime
 *     .functions(.invoke)         -> functions_invoke
 *   Because `.storage.from(...)` anchors on `.storage`, its trailing `.from` is
 *   never miscounted as a table op. Comments and string literals are trivia and
 *   are ignored by construction (they are not AST call/member nodes), so a
 *   `// supabase.from(...)` note and `Array.from` / `Buffer.from` are excluded.
 *
 * Baseline census (pinned commit 0536022b6de2268a0a654ba871d251b0c808ea1e):
 *   table 211 · storage 12 · rpc 1 · auth 19 · realtime 0 · functions_invoke 0
 *   => 243 approved occurrences (IDs 1..243).
 */
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export type Category =
  | "table"
  | "storage"
  | "auth"
  | "rpc"
  | "realtime"
  | "functions_invoke"
  | "other";

export const CATEGORIES: Category[] = [
  "table",
  "storage",
  "auth",
  "rpc",
  "realtime",
  "functions_invoke",
  "other",
];

/** Expected per-category census for the pinned baseline commit. */
export const EXPECTED_TOTALS: Record<string, number> = {
  table: 211,
  storage: 12,
  auth: 19,
  rpc: 1,
  realtime: 0,
  functions_invoke: 0,
  other: 0,
  total: 243,
};

/**
 * Permanent path exemptions. These are the ONLY paths exempt from the guard.
 * They are bounded and enumerated on purpose — there is no broad `src/**` or
 * directory-level exemption for authored runtime files.
 */
export const PERMANENT_PATH_EXEMPTIONS = [
  "src/routeTree.gen.ts",
  "src/integrations/supabase/types.ts",
  "supabase/migrations/**",
] as const;

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".output",
  ".vinxi",
  ".git",
  ".tanstack",
  ".nitro",
  ".wrangler",
  ".vscode",
  ".idea",
]);

/** Canonical Supabase client identifiers exported by the integration modules. */
const CLIENT_IDENTIFIERS = new Set(["supabase", "supabaseAdmin"]);

/** Property names that denote a client when read off another expression. */
const CLIENT_MEMBER_NAMES = new Set(["supabase", "supabaseAdmin"]);

const MEMBER_CATEGORY: Record<string, Category> = {
  from: "table",
  storage: "storage",
  auth: "auth",
  rpc: "rpc",
  functions: "functions_invoke",
  channel: "realtime",
  removeChannel: "realtime",
  removeAllChannels: "realtime",
  getChannels: "realtime",
  realtime: "realtime",
};

export interface SourceFileInput {
  path: string;
  text: string;
}

export interface Occurrence {
  id?: number;
  path: string;
  category: Category;
  receiver: string;
  operation: string;
  target: string | null;
  enclosingSymbol: string;
  ordinal: number;
  line: number;
  removalLane: string;
  removalCriterion: string;
}

export interface AllowlistOccurrence extends Occurrence {
  id: number;
}

export interface AllowlistFile {
  contract: string;
  blocker: string;
  repository: string;
  baseCommit: string;
  archiveSha256: string;
  generatedBy: string;
  note: string;
  permanentPathExemptions: string[];
  totals: Record<string, number>;
  occurrences: AllowlistOccurrence[];
}

export const REQUIRED_FIELDS: (keyof AllowlistOccurrence)[] = [
  "id",
  "path",
  "category",
  "receiver",
  "operation",
  "target",
  "enclosingSymbol",
  "ordinal",
  "line",
  "removalLane",
  "removalCriterion",
];

const KEY_SEP = "";
const NULL_TARGET = "∅";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

export function isExemptPath(path: string): boolean {
  const p = toPosix(path);
  if (p === "src/routeTree.gen.ts") return true;
  if (p === "src/integrations/supabase/types.ts") return true;
  if (p.startsWith("supabase/migrations/")) return true;
  return false;
}

/** Stable identity of an occurrence — deliberately excludes `line` (reporting
 * only), `id`, and the removal-lane annotations. */
export function occurrenceKey(o: {
  path: string;
  category: string;
  receiver: string;
  operation: string;
  target: string | null;
  enclosingSymbol: string;
  ordinal: number;
}): string {
  return [
    o.path,
    o.category,
    o.receiver,
    o.operation,
    o.target ?? NULL_TARGET,
    o.enclosingSymbol,
    String(o.ordinal),
  ].join(KEY_SEP);
}

interface RawOccurrence {
  path: string;
  category: Category;
  receiver: string;
  operation: string;
  target: string | null;
  enclosingSymbol: string;
  line: number;
  pos: number;
}

function collectLocalClientNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isCreateClientCall(node.initializer)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

function isCreateClientCall(node: ts.Expression): boolean {
  let expr: ts.Expression = node;
  if (ts.isAwaitExpression(expr)) expr = expr.expression;
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  return ts.isIdentifier(callee) && callee.text === "createClient";
}

function isClientBase(node: ts.Expression, localClients: Set<string>): boolean {
  if (ts.isIdentifier(node)) {
    return CLIENT_IDENTIFIERS.has(node.text) || localClients.has(node.text);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return CLIENT_MEMBER_NAMES.has(node.name.text);
  }
  return false;
}

function firstStringLiteralArg(call: ts.CallExpression): string | null {
  const first = call.arguments[0];
  if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
    return first.text;
  }
  return null;
}

/**
 * From a category anchor `<base>.<member>`, walk the fluent chain outward,
 * joining property names up to and including the first member that is directly
 * called, and capture that call's first string-literal argument (if any).
 */
function computeOperationAndTarget(anchor: ts.PropertyAccessExpression): {
  operation: string;
  target: string | null;
} {
  const names: string[] = [anchor.name.text];
  let cur: ts.Node = anchor;
  let target: string | null = null;
  for (;;) {
    const parent: ts.Node | undefined = cur.parent;
    if (parent && ts.isCallExpression(parent) && parent.expression === cur) {
      target = firstStringLiteralArg(parent);
      break;
    }
    if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === cur) {
      names.push(parent.name.text);
      cur = parent;
      continue;
    }
    break;
  }
  return { operation: names.join("."), target };
}

function enclosingSymbol(node: ts.Node): string {
  let n: ts.Node | undefined = node.parent;
  while (n) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (
      (ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n)) &&
      ts.isIdentifier(n.name)
    ) {
      return n.name.text;
    }
    if (ts.isConstructorDeclaration(n)) return "constructor";
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isPropertyDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isClassDeclaration(n) && n.name) return n.name.text;
    n = n.parent;
  }
  return "<module>";
}

function receiverText(anchor: ts.PropertyAccessExpression, sf: ts.SourceFile): string {
  const expr = anchor.expression;
  const raw = sf.text.slice(expr.getStart(sf), expr.getEnd());
  return raw.replace(/\s+/g, " ").trim();
}

function scanOneFile(path: string, text: string): RawOccurrence[] {
  const out: RawOccurrence[] = [];
  const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind);
  const localClients = collectLocalClientNames(sf);
  const posixPath = toPosix(path);
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && isClientBase(node.expression, localClients)) {
      const member = node.name.text;
      const category = MEMBER_CATEGORY[member] ?? "other";
      const { operation, target } = computeOperationAndTarget(node);
      const anchorStart = node.name.getStart(sf);
      const line = sf.getLineAndCharacterOfPosition(anchorStart).line + 1;
      out.push({
        path: posixPath,
        category,
        receiver: receiverText(node, sf),
        operation,
        target,
        enclosingSymbol: enclosingSymbol(node),
        line,
        pos: anchorStart,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

interface RemovalMapping {
  removalLane: string;
  removalCriterion: string;
}

const TABLE_LANE: Record<string, string> = {
  deals: "deals",
  deal_activity: "deals",
  deal_documents: "deals",
  deal_ownership: "deals",
  deal_ai_ownership: "deals",
  deal_shares: "sharing",
  deal_share_targets: "sharing",
  deal_share_activity: "sharing",
  deal_introductions: "sharing",
  startups: "startups",
  startup_activity: "startups",
  startup_ownership: "startups",
  startup_ai_ownership: "startups",
  startup_users: "startups",
  startup_media: "startups",
  startup_founders: "startups",
  startup_investors: "investors",
  investors: "investors",
  investor_activity: "investors",
  investor_ownership: "investors",
  investor_ai_ownership: "investors",
  investor_users: "investors",
  global_startups: "global-registry",
  global_startup_imports: "global-registry",
  users: "identity-tenancy",
  roles: "identity-tenancy",
  user_roles: "identity-tenancy",
  user_tenants: "identity-tenancy",
  user_sessions: "identity-tenancy",
  tenants: "identity-tenancy",
  workspace_context: "identity-tenancy",
  default_intake_settings: "identity-tenancy",
  notifications: "prefs-notifications",
  notification_preferences: "prefs-notifications",
  workspace_preferences: "prefs-notifications",
  saved_searches: "prefs-notifications",
  audit_logs: "audit-security",
  security_events: "audit-security",
};

const LANE_CRITERION: Record<string, string> = {
  deals:
    "Removed when the Tenant Deal CRUD Gateway contract serves deal reads/writes; the occurrence is deleted and re-pointed at the Gateway client.",
  sharing:
    "Removed when the Control-level Governed Sharing surface (IC-007 finalized) serves cross-tenant share/introduction operations; the occurrence is deleted.",
  startups:
    "Removed when the Tenant Startup CRUD Gateway contract serves startup reads/writes; the occurrence is deleted.",
  investors:
    "Removed when the Tenant Investor CRUD Gateway contract serves investor reads/writes; the occurrence is deleted.",
  "global-registry":
    "Removed when the Control global-registry read route (GET /directory/startup) and a Global Investor contract serve the master pool; the occurrence is deleted.",
  "identity-tenancy":
    "Removed when server-derived RequestContext and identity/tenancy Gateway routes replace browser-trusted RLS reads; the occurrence is deleted.",
  "prefs-notifications":
    "Removed when the Notifications/Preferences Gateway routes serve these reads/writes; the occurrence is deleted.",
  "audit-security":
    "Removed when the Gateway audit sink and security-event routes replace direct writes; the occurrence is deleted.",
  media:
    "Removed when the Media/Object-Storage Gateway contract mints signed URLs (recovering the startup-media bucket); the occurrence is deleted.",
  auth: "Removed at the OIDC auth cutover (endpoint D + transition C) when the Gateway-issued session replaces the Supabase browser session and getClaims validation; the occurrence is deleted.",
  import:
    "Removed when POST /import/<source_ref> (IC-003 Import) fully serves global->tenant import; the fn_import_global_startup RPC occurrence is deleted.",
  realtime:
    "No realtime contract is planned; any realtime occurrence must be removed before cutover.",
  "functions-invoke":
    "Out of cutover scope (deferred to B-8 / IC-006); no functions.invoke usage is permitted before the Intelligence phase.",
  review:
    "Uncategorized direct Supabase usage — requires triage before a removal lane can be assigned.",
};

function removalMapping(category: Category, target: string | null): RemovalMapping {
  let lane: string;
  switch (category) {
    case "table":
      lane = (target && TABLE_LANE[target]) || "review";
      break;
    case "storage":
      lane = "media";
      break;
    case "auth":
      lane = "auth";
      break;
    case "rpc":
      lane = "import";
      break;
    case "realtime":
      lane = "realtime";
      break;
    case "functions_invoke":
      lane = "functions-invoke";
      break;
    default:
      lane = "review";
      break;
  }
  return { removalLane: lane, removalCriterion: LANE_CRITERION[lane] ?? LANE_CRITERION.review };
}

export function scanSource(files: SourceFileInput[]): Occurrence[] {
  const raws: RawOccurrence[] = [];
  for (const file of files) {
    if (isExemptPath(file.path)) continue;
    raws.push(...scanOneFile(file.path, file.text));
  }
  raws.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.pos - b.pos));
  const ordinalCounter = new Map<string, number>();
  return raws.map((r) => {
    const groupKey = [
      r.path,
      r.category,
      r.receiver,
      r.operation,
      r.target ?? NULL_TARGET,
      r.enclosingSymbol,
    ].join(KEY_SEP);
    const ordinal = ordinalCounter.get(groupKey) ?? 0;
    ordinalCounter.set(groupKey, ordinal + 1);
    const { removalLane, removalCriterion } = removalMapping(r.category, r.target);
    return {
      path: r.path,
      category: r.category,
      receiver: r.receiver,
      operation: r.operation,
      target: r.target,
      enclosingSymbol: r.enclosingSymbol,
      ordinal,
      line: r.line,
      removalLane,
      removalCriterion,
    };
  });
}

export function collectSourceFiles(root: string): SourceFileInput[] {
  const out: SourceFileInput[] = [];
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && SCAN_EXTENSIONS.has(extname(entry.name))) {
        const rel = toPosix(relative(root, full));
        if (isExemptPath(rel)) continue;
        out.push({ path: rel, text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(root);
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

export function scanRepo(root: string): Occurrence[] {
  return scanSource(collectSourceFiles(root));
}

export interface ReconcileResult {
  ok: boolean;
  scanCount: number;
  allowCount: number;
  byCategory: Record<string, number>;
  unlisted: Occurrence[];
  orphaned: AllowlistOccurrence[];
}

export function reconcile(scan: Occurrence[], allow: AllowlistOccurrence[]): ReconcileResult {
  const allowByKey = new Map<string, AllowlistOccurrence>();
  for (const a of allow) allowByKey.set(occurrenceKey(a), a);
  const scanByKey = new Map<string, Occurrence>();
  for (const s of scan) scanByKey.set(occurrenceKey(s), s);
  const unlisted = scan.filter((s) => !allowByKey.has(occurrenceKey(s)));
  const orphaned = allow.filter((a) => !scanByKey.has(occurrenceKey(a)));
  const byCategory: Record<string, number> = {};
  for (const c of CATEGORIES) byCategory[c] = 0;
  for (const s of scan) byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
  return {
    ok: unlisted.length === 0 && orphaned.length === 0,
    scanCount: scan.length,
    allowCount: allow.length,
    byCategory,
    unlisted,
    orphaned,
  };
}

export interface StructureResult {
  ok: boolean;
  issues: string[];
}

export function validateAllowlistStructure(allow: AllowlistFile): StructureResult {
  const issues: string[] = [];
  const occ = allow.occurrences;
  if (!Array.isArray(occ)) {
    return { ok: false, issues: ["allowlist.occurrences is not an array"] };
  }
  const seenIds = new Set<number>();
  for (const o of occ) {
    if (typeof o.id !== "number" || !Number.isInteger(o.id)) {
      issues.push(`non-integer id: ${String(o.id)}`);
      continue;
    }
    if (seenIds.has(o.id)) issues.push(`duplicate id: ${o.id}`);
    seenIds.add(o.id);
    for (const field of REQUIRED_FIELDS) {
      if (!(field in o)) issues.push(`id ${o.id}: missing field "${String(field)}"`);
    }
  }
  const n = occ.length;
  for (let i = 1; i <= n; i++) {
    if (!seenIds.has(i)) issues.push(`missing contiguous id ${i} (expected 1..${n})`);
  }
  const seenKeys = new Set<string>();
  for (const o of occ) {
    const k = occurrenceKey(o);
    if (seenKeys.has(k)) issues.push(`duplicate identity key for id ${o.id}`);
    seenKeys.add(k);
  }
  return { ok: issues.length === 0, issues };
}

export function loadAllowlist(path: string): AllowlistFile {
  return JSON.parse(readFileSync(path, "utf8")) as AllowlistFile;
}

/* --------------------------------------------------------------------------
 * Separate Supabase-surface inventory (informational; not part of the 243).
 * ------------------------------------------------------------------------ */

export interface InventoryItem {
  path: string;
  line: number;
  detail: string;
}

export interface Inventory {
  packageImports: InventoryItem[];
  integrationModuleImports: InventoryItem[];
  createClientCalls: InventoryItem[];
  envKeyReads: InventoryItem[];
  providerUrlLiterals: InventoryItem[];
  supabaseAdminReferences: InventoryItem[];
}

const ENV_KEY_PATTERN = /^(VITE_)?SUPABASE_[A-Z0-9_]+$/;
const PROVIDER_URL_PATTERN = /[a-z0-9-]+\.supabase\.(co|in)\b/i;

function isIntegrationClientSpecifier(spec: string): boolean {
  return (
    spec === "./client" ||
    spec === "./client.server" ||
    /integrations\/supabase\/client(\.server)?$/.test(spec)
  );
}

export function inventorySupabaseSurface(files: SourceFileInput[]): Inventory {
  const inv: Inventory = {
    packageImports: [],
    integrationModuleImports: [],
    createClientCalls: [],
    envKeyReads: [],
    providerUrlLiterals: [],
    supabaseAdminReferences: [],
  };
  for (const file of files) {
    if (isExemptPath(file.path)) continue;
    const posixPath = toPosix(file.path);
    const scriptKind = file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, scriptKind);
    const lineOf = (node: ts.Node): number =>
      sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        if (spec === "@supabase/supabase-js") {
          inv.packageImports.push({ path: posixPath, line: lineOf(node), detail: spec });
        } else if (isIntegrationClientSpecifier(spec)) {
          inv.integrationModuleImports.push({ path: posixPath, line: lineOf(node), detail: spec });
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "createClient"
      ) {
        inv.createClientCalls.push({
          path: posixPath,
          line: lineOf(node),
          detail: "createClient(...)",
        });
      }
      if (ts.isPropertyAccessExpression(node) && ENV_KEY_PATTERN.test(node.name.text)) {
        inv.envKeyReads.push({ path: posixPath, line: lineOf(node), detail: node.name.text });
      }
      if (ts.isIdentifier(node) && node.text === "supabaseAdmin") {
        inv.supabaseAdminReferences.push({
          path: posixPath,
          line: lineOf(node),
          detail: "supabaseAdmin",
        });
      }
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        PROVIDER_URL_PATTERN.test(node.text)
      ) {
        inv.providerUrlLiterals.push({ path: posixPath, line: lineOf(node), detail: node.text });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return inv;
}

/* --------------------------------------------------------------------------
 * Baseline emitter + report.
 * ------------------------------------------------------------------------ */

export function assignIds(scan: Occurrence[]): AllowlistOccurrence[] {
  return scan.map((o, i) => ({ ...o, id: i + 1 }));
}

export function emitBaseline(scan: Occurrence[]): string {
  const occurrences = assignIds(scan);
  const totals: Record<string, number> = { total: occurrences.length };
  for (const c of CATEGORIES) totals[c] = occurrences.filter((o) => o.category === c).length;
  const file: AllowlistFile = {
    contract: "B5-BLK-5 Zero-Direct-Supabase Guard",
    blocker: "B5-BLK-5",
    repository: "Pitchsnack/snack-cosmos",
    baseCommit: "0536022b6de2268a0a654ba871d251b0c808ea1e",
    archiveSha256: "535e126fc317700e497fec94c76064075ad4157794b68231e3a043144ac57d5b",
    generatedBy: "scripts/check-no-direct-supabase.ts --emit",
    note: "Frozen ratchet baseline of direct @supabase/supabase-js SDK call sites. Entries may be removed as call sites are re-pointed at the API Gateway; entries may never be added.",
    permanentPathExemptions: [...PERMANENT_PATH_EXEMPTIONS],
    totals,
    occurrences,
  };
  return JSON.stringify(file, null, 2) + "\n";
}

export function formatReport(
  scan: Occurrence[],
  allow: AllowlistFile,
  rec: ReconcileResult,
  structure: StructureResult,
  inv: Inventory,
): string {
  const lines: string[] = [];
  lines.push("Zero-Direct-Supabase Guard (B5-BLK-5)");
  lines.push("=====================================");
  lines.push(`scanned direct SDK call sites : ${rec.scanCount}`);
  lines.push(`allowlisted occurrences       : ${rec.allowCount}`);
  lines.push("");
  lines.push("category census (scanned | expected):");
  for (const c of CATEGORIES) {
    const expected = EXPECTED_TOTALS[c] ?? 0;
    const flag = rec.byCategory[c] === expected ? "" : "  <-- MISMATCH";
    lines.push(
      `  ${c.padEnd(18)} ${String(rec.byCategory[c]).padStart(4)} | ${String(expected).padStart(4)}${flag}`,
    );
  }
  lines.push("");
  lines.push("supabase surface inventory (informational, not part of the 243):");
  lines.push(`  package imports (@supabase/supabase-js) : ${inv.packageImports.length}`);
  lines.push(`  integration-module imports              : ${inv.integrationModuleImports.length}`);
  lines.push(`  createClient calls                      : ${inv.createClientCalls.length}`);
  lines.push(`  supabase env-key reads                  : ${inv.envKeyReads.length}`);
  lines.push(`  provider URL literals                   : ${inv.providerUrlLiterals.length}`);
  lines.push(`  supabaseAdmin references                : ${inv.supabaseAdminReferences.length}`);
  lines.push("");

  if (!structure.ok) {
    lines.push("ALLOWLIST STRUCTURE ERRORS:");
    for (const issue of structure.issues.slice(0, 50)) lines.push(`  - ${issue}`);
    if (structure.issues.length > 50) lines.push(`  ...and ${structure.issues.length - 50} more`);
    lines.push("");
  }

  if (rec.unlisted.length > 0) {
    lines.push(
      `FAIL: ${rec.unlisted.length} NEW direct Supabase call site(s) not in the allowlist.`,
    );
    lines.push("Re-point these at the API Gateway, or (only if genuinely unavoidable) add a");
    lines.push("reviewed allowlist entry. New direct Supabase usage is a governed regression.");
    for (const u of rec.unlisted.slice(0, 100)) {
      lines.push(
        `  + ${u.path}:${u.line}  [${u.category}] ${u.receiver}.${u.operation}` +
          `${u.target ? ` "${u.target}"` : ""}  in ${u.enclosingSymbol}#${u.ordinal}`,
      );
    }
    lines.push("");
  }

  if (rec.orphaned.length > 0) {
    lines.push(
      `FAIL: ${rec.orphaned.length} allowlist entr(y/ies) no longer match any source call site.`,
    );
    lines.push("If the call site was removed, delete its allowlist entry in the same change.");
    for (const o of rec.orphaned.slice(0, 100)) {
      lines.push(
        `  - id ${o.id}: ${o.path} [${o.category}] ${o.receiver}.${o.operation}` +
          `${o.target ? ` "${o.target}"` : ""}  in ${o.enclosingSymbol}#${o.ordinal}`,
      );
    }
    lines.push("");
  }

  if (rec.ok && structure.ok) {
    lines.push(
      `OK: all ${rec.scanCount} direct Supabase call sites match the frozen baseline of ${allow.occurrences.length}.`,
    );
  }
  return lines.join("\n") + "\n";
}

function main(argv: string[]): number {
  const root = process.cwd();
  const files = collectSourceFiles(root);
  const scan = scanSource(files);
  if (argv.includes("--emit")) {
    process.stdout.write(emitBaseline(scan));
    return 0;
  }
  const allowPath = join(root, "test", "architecture", "supabase-allowlist.json");
  const allow = loadAllowlist(allowPath);
  const structure = validateAllowlistStructure(allow);
  const rec = reconcile(scan, allow.occurrences);
  const inv = inventorySupabaseSurface(files);
  process.stdout.write(formatReport(scan, allow, rec, structure, inv));
  return rec.ok && structure.ok ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[check-no-direct-supabase] fatal: ${message}\n`);
    process.exit(2);
  }
}
