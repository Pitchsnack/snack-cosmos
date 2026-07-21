/**
 * check-no-direct-supabase.ts
 * -----------------------------------------------------------------------------
 * B5-BLK-5 — Zero-Direct-Supabase Guard (scaffold, read-only).
 *
 * Purpose
 *   Freeze the current inventory of direct `@supabase/supabase-js` SDK call
 *   sites (and the surrounding Supabase dependency surface) in the Lovable
 *   frontend as a fixed baseline, and fail whenever a new occurrence is added
 *   or an approved occurrence is removed without also removing its allowlist
 *   entry. This is a *ratchet*: the active sets may only shrink (as call sites
 *   are re-pointed at the API Gateway during cutover), never grow.
 *
 * Scope / boundary
 *   Static analyzer only. It never opens a network socket, never contacts
 *   Supabase, never touches auth / storage / RLS / a database / the Gateway
 *   runtime. It parses TypeScript/TSX with the TypeScript compiler API
 *   (syntactic AST only — no type-checker, no program) and reports. The one
 *   non-static thing it can do is read a *base* copy of the allowlist out of
 *   git (`git show <ref>:...`) for the pull-request ratchet comparison.
 *
 * Two independent inventories (separate ID spaces; see START-GATE §5, §6):
 *   direct_sdk_baseline — the 243 direct SDK call sites:
 *     table 211 · storage 12 · auth 19 · rpc 1 · realtime 0 · functions.invoke 0
 *   dependency_baseline — the surrounding Supabase dependency surface:
 *     package imports · integration-module imports · createClient calls ·
 *     env-key reads · provider URL literals · supabaseAdmin references
 *
 * Classification (direct SDK)
 *   A "direct SDK call site" is a property access whose immediate receiver is a
 *   Supabase client base (`supabase`, `supabaseAdmin`, `<expr>.supabase`, or a
 *   local `createClient(...)` binding). The property accessed on the base is the
 *   category anchor: .from -> table, .storage -> storage, .auth -> auth,
 *   .rpc -> rpc, .channel/.removeChannel/.removeAllChannels/.getChannels/
 *   .realtime -> realtime, .functions(.invoke) -> functions_invoke. Because
 *   `.storage.from(...)` anchors on `.storage`, its trailing `.from` is never
 *   miscounted as a table op, and auth-state listeners (`.auth.onAuthStateChange`)
 *   are auth, not realtime. Comments and string literals are trivia (not AST
 *   call/member nodes) so they are ignored by construction — as are `Array.from`
 *   and `Buffer.from`.
 *
 * Base commit: 0536022b6de2268a0a654ba871d251b0c808ea1e
 * Archive SHA-256: 535e126fc317700e497fec94c76064075ad4157794b68231e3a043144ac57d5b
 */
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

/* ==========================================================================
 * Constants and types.
 * ======================================================================== */

export type DirectCategory =
  | "table"
  | "storage"
  | "auth"
  | "rpc"
  | "realtime"
  | "functions_invoke"
  | "other";

export const DIRECT_CATEGORIES: DirectCategory[] = [
  "table",
  "storage",
  "auth",
  "rpc",
  "realtime",
  "functions_invoke",
  "other",
];

export type DependencyCategory =
  | "package_import"
  | "integration_module_import"
  | "create_client_call"
  | "env_key_read"
  | "provider_url_literal"
  | "supabase_admin_reference";

export const DEPENDENCY_CATEGORIES: DependencyCategory[] = [
  "package_import",
  "integration_module_import",
  "create_client_call",
  "env_key_read",
  "provider_url_literal",
  "supabase_admin_reference",
];

/** Expected per-category direct-SDK census for the pinned baseline commit. */
export const EXPECTED_DIRECT_TOTALS: Record<string, number> = {
  table: 211,
  storage: 12,
  auth: 19,
  rpc: 1,
  realtime: 0,
  functions_invoke: 0,
  other: 0,
  total: 243,
};

export const ALLOWLIST_RELATIVE_PATH = "test/architecture/supabase-allowlist.json";

export const SOURCE_COMMIT = "0536022b6de2268a0a654ba871d251b0c808ea1e";
export const ARCHIVE_SHA256 = "535e126fc317700e497fec94c76064075ad4157794b68231e3a043144ac57d5b";
export const OWNER = "GPT+Dan";
export const SCHEMA_VERSION = 1;

/**
 * Permanent path exemptions. These are the ONLY paths exempt from the guard —
 * bounded and enumerated on purpose. There is no broad `src/**` or directory
 * exemption for authored runtime files.
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

const MEMBER_CATEGORY: Record<string, DirectCategory> = {
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

export interface DirectOccurrence {
  id?: number;
  path: string;
  category: DirectCategory;
  receiver: string;
  operation: string;
  target: string | null;
  enclosingSymbol: string;
  ordinal: number;
  line: number;
  removalLane: string;
  removalCriterion: string;
}

export interface DependencyOccurrence {
  id?: number;
  path: string;
  category: DependencyCategory;
  symbol: string;
  enclosingSymbol: string;
  ordinal: number;
  line: number;
  removalLane: string;
  removalCriterion: string;
}

export const DIRECT_REQUIRED_FIELDS = [
  "id",
  "path",
  "category",
  "receiver",
  "operation",
  "target",
  "enclosing_symbol",
  "ordinal",
  "line",
  "removal_lane",
  "removal_criterion",
] as const;

export const DEPENDENCY_REQUIRED_FIELDS = [
  "id",
  "path",
  "category",
  "symbol",
  "enclosing_symbol",
  "ordinal",
  "line",
  "removal_lane",
  "removal_criterion",
] as const;

const NULL_TARGET = "∅";
const KEY_SEP = "";

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

/* ==========================================================================
 * Shared AST helpers.
 * ======================================================================== */

function createSf(path: string, text: string): ts.SourceFile {
  const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind);
}

function isCreateClientCall(node: ts.Expression): boolean {
  let expr: ts.Expression = node;
  if (ts.isAwaitExpression(expr)) expr = expr.expression;
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  return ts.isIdentifier(callee) && callee.text === "createClient";
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

/* ==========================================================================
 * Removal-lane mapping (deterministic governance annotation).
 * ======================================================================== */

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
  "integration-seam":
    "Removed when the @supabase/supabase-js client integration seam is deleted at cutover completion and the import is re-pointed at the Gateway client.",
  "env-config":
    "Removed when Supabase environment configuration is retired after the Gateway cutover completes.",
  "service-role":
    "Removed when service-role admin operations are replaced by Gateway-mediated privileged endpoints.",
  review:
    "Uncategorized direct Supabase usage — requires triage before a removal lane can be assigned.",
};

function directRemovalLane(category: DirectCategory, target: string | null): string {
  switch (category) {
    case "table":
      return (target && TABLE_LANE[target]) || "review";
    case "storage":
      return "media";
    case "auth":
      return "auth";
    case "rpc":
      return "import";
    case "realtime":
      return "realtime";
    case "functions_invoke":
      return "functions-invoke";
    default:
      return "review";
  }
}

function dependencyRemovalLane(category: DependencyCategory): string {
  switch (category) {
    case "package_import":
    case "integration_module_import":
    case "create_client_call":
      return "integration-seam";
    case "env_key_read":
    case "provider_url_literal":
      return "env-config";
    case "supabase_admin_reference":
      return "service-role";
    default:
      return "review";
  }
}

function laneCriterion(lane: string): string {
  return LANE_CRITERION[lane] ?? LANE_CRITERION.review;
}

/* ==========================================================================
 * Direct SDK scanning.
 * ======================================================================== */

interface RawDirect {
  path: string;
  category: DirectCategory;
  receiver: string;
  operation: string;
  target: string | null;
  enclosingSymbol: string;
  line: number;
  pos: number;
}

function scanDirectFile(path: string, text: string): RawDirect[] {
  const out: RawDirect[] = [];
  const sf = createSf(path, text);
  const localClients = collectLocalClientNames(sf);
  const posixPath = toPosix(path);
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && isClientBase(node.expression, localClients)) {
      const member = node.name.text;
      const category = MEMBER_CATEGORY[member] ?? "other";
      const { operation, target } = computeOperationAndTarget(node);
      const anchorStart = node.name.getStart(sf);
      out.push({
        path: posixPath,
        category,
        receiver: receiverText(node, sf),
        operation,
        target,
        enclosingSymbol: enclosingSymbol(node),
        line: sf.getLineAndCharacterOfPosition(anchorStart).line + 1,
        pos: anchorStart,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export function scanDirect(files: SourceFileInput[]): DirectOccurrence[] {
  const raws: RawDirect[] = [];
  for (const file of files) {
    if (isExemptPath(file.path)) continue;
    raws.push(...scanDirectFile(file.path, file.text));
  }
  raws.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.pos - b.pos));
  const ordinals = new Map<string, number>();
  return raws.map((r) => {
    const groupKey = [
      r.path,
      r.category,
      r.receiver,
      r.operation,
      r.target ?? NULL_TARGET,
      r.enclosingSymbol,
    ].join(KEY_SEP);
    const ordinal = ordinals.get(groupKey) ?? 0;
    ordinals.set(groupKey, ordinal + 1);
    const removalLane = directRemovalLane(r.category, r.target);
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
      removalCriterion: laneCriterion(removalLane),
    };
  });
}

export function directKey(o: {
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

/* ==========================================================================
 * Dependency-surface scanning.
 * ======================================================================== */

const ENV_KEY_PATTERN = /^(VITE_)?SUPABASE_[A-Z0-9_]+$/;
const PROVIDER_URL_PATTERN = /[a-z0-9-]+\.supabase\.(co|in)\b/i;

function isIntegrationClientSpecifier(spec: string): boolean {
  return (
    spec === "./client" ||
    spec === "./client.server" ||
    /integrations\/supabase\/client(\.server)?$/.test(spec)
  );
}

interface RawDependency {
  path: string;
  category: DependencyCategory;
  symbol: string;
  enclosingSymbol: string;
  line: number;
  pos: number;
}

function scanDependencyFile(path: string, text: string): RawDependency[] {
  const out: RawDependency[] = [];
  const sf = createSf(path, text);
  const posixPath = toPosix(path);
  const push = (category: DependencyCategory, symbol: string, node: ts.Node): void => {
    const start = node.getStart(sf);
    out.push({
      path: posixPath,
      category,
      symbol,
      enclosingSymbol: enclosingSymbol(node),
      line: sf.getLineAndCharacterOfPosition(start).line + 1,
      pos: start,
    });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec === "@supabase/supabase-js") push("package_import", spec, node);
      else if (isIntegrationClientSpecifier(spec)) push("integration_module_import", spec, node);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "createClient"
    ) {
      push("create_client_call", "createClient", node);
    }
    if (ts.isPropertyAccessExpression(node) && ENV_KEY_PATTERN.test(node.name.text)) {
      push("env_key_read", node.name.text, node.name);
    }
    if (ts.isIdentifier(node) && node.text === "supabaseAdmin") {
      push("supabase_admin_reference", "supabaseAdmin", node);
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      PROVIDER_URL_PATTERN.test(node.text)
    ) {
      push("provider_url_literal", node.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export function scanDependencies(files: SourceFileInput[]): DependencyOccurrence[] {
  const raws: RawDependency[] = [];
  for (const file of files) {
    if (isExemptPath(file.path)) continue;
    raws.push(...scanDependencyFile(file.path, file.text));
  }
  raws.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.pos - b.pos));
  const ordinals = new Map<string, number>();
  return raws.map((r) => {
    const groupKey = [r.path, r.category, r.symbol, r.enclosingSymbol].join(KEY_SEP);
    const ordinal = ordinals.get(groupKey) ?? 0;
    ordinals.set(groupKey, ordinal + 1);
    const removalLane = dependencyRemovalLane(r.category);
    return {
      path: r.path,
      category: r.category,
      symbol: r.symbol,
      enclosingSymbol: r.enclosingSymbol,
      ordinal,
      line: r.line,
      removalLane,
      removalCriterion: laneCriterion(removalLane),
    };
  });
}

export function dependencyKey(o: {
  path: string;
  category: string;
  symbol: string;
  enclosingSymbol: string;
  ordinal: number;
}): string {
  return [o.path, o.category, o.symbol, o.enclosingSymbol, String(o.ordinal)].join(KEY_SEP);
}

/* ==========================================================================
 * File collection.
 * ======================================================================== */

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

export interface ScanResult {
  direct: DirectOccurrence[];
  dependency: DependencyOccurrence[];
}

export function scanRepo(root: string): ScanResult {
  const files = collectSourceFiles(root);
  return { direct: scanDirect(files), dependency: scanDependencies(files) };
}

/* ==========================================================================
 * Allowlist model (START-GATE §8 schema) + (de)serialization.
 * ======================================================================== */

export interface Allowlist {
  schemaVersion: number;
  sourceCommit: string;
  owner: string;
  permanentExemptions: string[];
  direct: DirectOccurrence[];
  dependency: DependencyOccurrence[];
  activeDirectIds: number[];
  activeDependencyIds: number[];
  directTotal: number;
  dependencyTotal: number;
}

function categoryCounts(
  items: { category: string }[],
  categories: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of categories) out[c] = 0;
  for (const i of items) out[i.category] = (out[i.category] ?? 0) + 1;
  return out;
}

export function buildAllowlist(scan: ScanResult): Allowlist {
  const direct = scan.direct.map((o, i) => ({ ...o, id: i + 1 }));
  const dependency = scan.dependency.map((o, i) => ({ ...o, id: i + 1 }));
  return {
    schemaVersion: SCHEMA_VERSION,
    sourceCommit: SOURCE_COMMIT,
    owner: OWNER,
    permanentExemptions: [...PERMANENT_PATH_EXEMPTIONS],
    direct,
    dependency,
    activeDirectIds: direct.map((o) => o.id as number),
    activeDependencyIds: dependency.map((o) => o.id as number),
    directTotal: direct.length,
    dependencyTotal: dependency.length,
  };
}

export function serializeAllowlist(allow: Allowlist): string {
  const doc = {
    schema_version: allow.schemaVersion,
    source_commit: allow.sourceCommit,
    archive_sha256: ARCHIVE_SHA256,
    owner: allow.owner,
    generated_by: "scripts/check-no-direct-supabase.ts --emit",
    note: "Frozen ratchet baseline of the direct @supabase/supabase-js SDK call sites and the surrounding Supabase dependency surface. Active IDs may be removed as call sites are re-pointed at the API Gateway; active IDs may never be added.",
    permanent_exemptions: allow.permanentExemptions,
    direct_sdk_baseline: {
      total: allow.directTotal,
      by_category: categoryCounts(allow.direct, DIRECT_CATEGORIES),
      occurrences: allow.direct.map((o) => ({
        id: o.id,
        path: o.path,
        category: o.category,
        receiver: o.receiver,
        operation: o.operation,
        target: o.target,
        enclosing_symbol: o.enclosingSymbol,
        ordinal: o.ordinal,
        line: o.line,
        removal_lane: o.removalLane,
        removal_criterion: o.removalCriterion,
      })),
    },
    dependency_baseline: {
      total: allow.dependencyTotal,
      by_category: categoryCounts(allow.dependency, DEPENDENCY_CATEGORIES),
      occurrences: allow.dependency.map((o) => ({
        id: o.id,
        path: o.path,
        category: o.category,
        symbol: o.symbol,
        enclosing_symbol: o.enclosingSymbol,
        ordinal: o.ordinal,
        line: o.line,
        removal_lane: o.removalLane,
        removal_criterion: o.removalCriterion,
      })),
    },
    active_direct_sdk_ids: allow.activeDirectIds,
    active_dependency_ids: allow.activeDependencyIds,
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

interface RawAllowlistDoc {
  schema_version?: number;
  source_commit?: string;
  owner?: string;
  permanent_exemptions?: string[];
  direct_sdk_baseline?: { total?: number; occurrences?: RawDirectEntry[] };
  dependency_baseline?: { total?: number; occurrences?: RawDependencyEntry[] };
  active_direct_sdk_ids?: number[];
  active_dependency_ids?: number[];
}

interface RawDirectEntry {
  id: number;
  path: string;
  category: DirectCategory;
  receiver: string;
  operation: string;
  target: string | null;
  enclosing_symbol: string;
  ordinal: number;
  line: number;
  removal_lane: string;
  removal_criterion: string;
}

interface RawDependencyEntry {
  id: number;
  path: string;
  category: DependencyCategory;
  symbol: string;
  enclosing_symbol: string;
  ordinal: number;
  line: number;
  removal_lane: string;
  removal_criterion: string;
}

export function parseAllowlist(json: string): Allowlist {
  const doc = JSON.parse(json) as RawAllowlistDoc;
  const direct = (doc.direct_sdk_baseline?.occurrences ?? []).map((e) => ({
    id: e.id,
    path: e.path,
    category: e.category,
    receiver: e.receiver,
    operation: e.operation,
    target: e.target,
    enclosingSymbol: e.enclosing_symbol,
    ordinal: e.ordinal,
    line: e.line,
    removalLane: e.removal_lane,
    removalCriterion: e.removal_criterion,
  }));
  const dependency = (doc.dependency_baseline?.occurrences ?? []).map((e) => ({
    id: e.id,
    path: e.path,
    category: e.category,
    symbol: e.symbol,
    enclosingSymbol: e.enclosing_symbol,
    ordinal: e.ordinal,
    line: e.line,
    removalLane: e.removal_lane,
    removalCriterion: e.removal_criterion,
  }));
  return {
    schemaVersion: doc.schema_version ?? 0,
    sourceCommit: doc.source_commit ?? "",
    owner: doc.owner ?? "",
    permanentExemptions: doc.permanent_exemptions ?? [],
    direct,
    dependency,
    activeDirectIds: doc.active_direct_sdk_ids ?? [],
    activeDependencyIds: doc.active_dependency_ids ?? [],
    directTotal: doc.direct_sdk_baseline?.total ?? direct.length,
    dependencyTotal: doc.dependency_baseline?.total ?? dependency.length,
  };
}

export function loadAllowlist(path: string): Allowlist {
  return parseAllowlist(readFileSync(path, "utf8"));
}

/* ==========================================================================
 * Structure validation + reconciliation.
 * ======================================================================== */

export interface StructureResult {
  ok: boolean;
  issues: string[];
}

export function validateStructure(allow: Allowlist): StructureResult {
  const issues: string[] = [];
  if (allow.schemaVersion !== SCHEMA_VERSION)
    issues.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (allow.sourceCommit !== SOURCE_COMMIT) issues.push(`source_commit must be ${SOURCE_COMMIT}`);
  if (allow.owner !== OWNER) issues.push(`owner must be ${OWNER}`);
  if (allow.directTotal !== EXPECTED_DIRECT_TOTALS.total) {
    issues.push(`direct_sdk_baseline.total must be ${EXPECTED_DIRECT_TOTALS.total}`);
  }

  validateOccurrenceIds(allow.direct, "direct", DIRECT_INTERNAL_FIELDS, issues);
  validateOccurrenceIds(allow.dependency, "dependency", DEPENDENCY_INTERNAL_FIELDS, issues);

  // Active sets must reference existing IDs and, for the frozen baseline,
  // equal the full baseline (initial active === baseline).
  validateActiveSet(allow.direct, allow.activeDirectIds, "direct", issues);
  validateActiveSet(allow.dependency, allow.activeDependencyIds, "dependency", issues);

  return { ok: issues.length === 0, issues };
}

const DIRECT_INTERNAL_FIELDS = [
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
] as const;

const DEPENDENCY_INTERNAL_FIELDS = [
  "path",
  "category",
  "symbol",
  "enclosingSymbol",
  "ordinal",
  "line",
  "removalLane",
  "removalCriterion",
] as const;

function validateOccurrenceIds(
  occ: { id?: number }[],
  label: string,
  fields: readonly string[],
  issues: string[],
): void {
  const seen = new Set<number>();
  for (const o of occ) {
    const record = o as unknown as Record<string, unknown>;
    if (typeof o.id !== "number" || !Number.isInteger(o.id)) {
      issues.push(`${label}: non-integer id ${String(o.id)}`);
      continue;
    }
    if (seen.has(o.id)) issues.push(`${label}: duplicate id ${o.id}`);
    seen.add(o.id);
    for (const field of fields) {
      // `target` may legitimately be null; missing JSON fields parse to undefined.
      if (record[field] === undefined) issues.push(`${label} id ${o.id}: missing field "${field}"`);
    }
  }
  const n = occ.length;
  for (let i = 1; i <= n; i++) {
    if (!seen.has(i)) issues.push(`${label}: missing contiguous id ${i} (expected 1..${n})`);
  }
}

function validateActiveSet(
  occ: { id?: number }[],
  activeIds: number[],
  label: string,
  issues: string[],
): void {
  const ids = new Set(occ.map((o) => o.id));
  const active = new Set(activeIds);
  if (active.size !== activeIds.length) issues.push(`${label}: active id set contains duplicates`);
  for (const id of activeIds) {
    if (!ids.has(id)) issues.push(`${label}: active id ${id} has no baseline entry`);
  }
  // Bootstrap invariant: initial active set equals the full baseline.
  for (const o of occ) {
    if (typeof o.id === "number" && !active.has(o.id)) {
      issues.push(`${label}: baseline id ${o.id} is not in the active set`);
    }
  }
}

export interface ReconcileResult {
  ok: boolean;
  directUnlisted: DirectOccurrence[];
  directOrphaned: DirectOccurrence[];
  dependencyUnlisted: DependencyOccurrence[];
  dependencyOrphaned: DependencyOccurrence[];
  directByCategory: Record<string, number>;
  dependencyByCategory: Record<string, number>;
}

/** Reconcile a fresh scan against the ACTIVE entries of an allowlist. */
export function reconcile(scan: ScanResult, allow: Allowlist): ReconcileResult {
  const activeDirect = allow.direct.filter((o) => allow.activeDirectIds.includes(o.id as number));
  const activeDependency = allow.dependency.filter((o) =>
    allow.activeDependencyIds.includes(o.id as number),
  );

  const { unlisted: directUnlisted, orphaned: directOrphaned } = diffSets(
    scan.direct,
    activeDirect,
    directKey,
  );
  const { unlisted: dependencyUnlisted, orphaned: dependencyOrphaned } = diffSets(
    scan.dependency,
    activeDependency,
    dependencyKey,
  );

  return {
    ok:
      directUnlisted.length === 0 &&
      directOrphaned.length === 0 &&
      dependencyUnlisted.length === 0 &&
      dependencyOrphaned.length === 0,
    directUnlisted,
    directOrphaned,
    dependencyUnlisted,
    dependencyOrphaned,
    directByCategory: categoryCounts(scan.direct, DIRECT_CATEGORIES),
    dependencyByCategory: categoryCounts(scan.dependency, DEPENDENCY_CATEGORIES),
  };
}

function diffSets<T extends { id?: number }>(
  scan: T[],
  active: T[],
  keyFn: (o: T) => string,
): { unlisted: T[]; orphaned: T[] } {
  const activeByKey = new Map<string, T>();
  for (const a of active) activeByKey.set(keyFn(a), a);
  const scanByKey = new Map<string, T>();
  for (const s of scan) scanByKey.set(keyFn(s), s);
  return {
    unlisted: scan.filter((s) => !activeByKey.has(keyFn(s))),
    orphaned: active.filter((a) => !scanByKey.has(keyFn(a))),
  };
}

/* ==========================================================================
 * Ratchet: base-vs-head comparison + bootstrap (START-GATE §9).
 * ======================================================================== */

export interface RatchetResult {
  ok: boolean;
  bootstrap: boolean;
  issues: string[];
}

export function compareRatchet(base: Allowlist | null, head: Allowlist): RatchetResult {
  const issues: string[] = [];

  // Bootstrap: the base has no allowlist. Allowed only for the first scaffold
  // PR, and only when the head census is exactly the accepted baseline.
  if (base === null) {
    const counts = categoryCounts(head.direct, DIRECT_CATEGORIES);
    if (head.directTotal !== EXPECTED_DIRECT_TOTALS.total) {
      issues.push(`bootstrap: direct total ${head.directTotal} != ${EXPECTED_DIRECT_TOTALS.total}`);
    }
    for (const c of DIRECT_CATEGORIES) {
      if (counts[c] !== EXPECTED_DIRECT_TOTALS[c]) {
        issues.push(`bootstrap: ${c} subcount ${counts[c]} != ${EXPECTED_DIRECT_TOTALS[c]}`);
      }
    }
    return { ok: issues.length === 0, bootstrap: true, issues };
  }

  // Shrink-only: current active IDs must be a subset of base active IDs.
  subsetCheck(head.activeDirectIds, base.activeDirectIds, "direct", issues);
  subsetCheck(head.activeDependencyIds, base.activeDependencyIds, "dependency", issues);

  // Shared IDs must keep the same fingerprint (line number may move).
  fingerprintStableCheck(base.direct, head.direct, directKey, "direct", issues);
  fingerprintStableCheck(base.dependency, head.dependency, dependencyKey, "dependency", issues);

  return { ok: issues.length === 0, bootstrap: false, issues };
}

function subsetCheck(headIds: number[], baseIds: number[], label: string, issues: string[]): void {
  const base = new Set(baseIds);
  for (const id of headIds) {
    if (!base.has(id)) {
      issues.push(
        `${label}: active id ${id} was ADDED relative to base (allowlist growth forbidden)`,
      );
    }
  }
}

function fingerprintStableCheck<T extends { id?: number }>(
  base: T[],
  head: T[],
  keyFn: (o: T) => string,
  label: string,
  issues: string[],
): void {
  const baseById = new Map<number, T>();
  for (const b of base) if (typeof b.id === "number") baseById.set(b.id, b);
  for (const h of head) {
    if (typeof h.id !== "number") continue;
    const b = baseById.get(h.id);
    if (b && keyFn(b) !== keyFn(h)) {
      issues.push(`${label}: id ${h.id} fingerprint changed under an existing id (forbidden)`);
    }
  }
}

/** Read a base allowlist out of git; returns null when the file is absent. */
export function readBaseAllowlist(ref: string, root: string): Allowlist | null {
  try {
    const json = execFileSync("git", ["show", `${ref}:${ALLOWLIST_RELATIVE_PATH}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseAllowlist(json);
  } catch {
    return null;
  }
}

/* ==========================================================================
 * Reporting.
 * ======================================================================== */

export function formatReport(
  scan: ScanResult,
  allow: Allowlist,
  structure: StructureResult,
  rec: ReconcileResult,
): string {
  const lines: string[] = [];
  lines.push("Zero-Direct-Supabase Guard (B5-BLK-5)");
  lines.push("=====================================");
  lines.push(`direct SDK call sites scanned : ${scan.direct.length}`);
  lines.push(`direct SDK active allowlist   : ${allow.activeDirectIds.length}`);
  lines.push(`dependency sites scanned      : ${scan.dependency.length}`);
  lines.push(`dependency active allowlist   : ${allow.activeDependencyIds.length}`);
  lines.push("");
  lines.push("direct SDK census (scanned | expected):");
  for (const c of DIRECT_CATEGORIES) {
    const expected = EXPECTED_DIRECT_TOTALS[c] ?? 0;
    const got = rec.directByCategory[c] ?? 0;
    const flag = got === expected ? "" : "  <-- MISMATCH";
    lines.push(
      `  ${c.padEnd(18)} ${String(got).padStart(4)} | ${String(expected).padStart(4)}${flag}`,
    );
  }
  lines.push("");
  lines.push("dependency surface census (separate ID space, not part of the 243):");
  for (const c of DEPENDENCY_CATEGORIES) {
    lines.push(`  ${c.padEnd(28)} ${String(rec.dependencyByCategory[c] ?? 0).padStart(4)}`);
  }
  lines.push("");

  if (!structure.ok) {
    lines.push("ALLOWLIST STRUCTURE ERRORS:");
    for (const issue of structure.issues.slice(0, 60)) lines.push(`  - ${issue}`);
    lines.push("");
  }

  emitViolationBlock(
    lines,
    "NEW direct Supabase call site(s) not in the active allowlist",
    rec.directUnlisted.map(
      (u) =>
        `  + ${u.path}:${u.line} [${u.category}] ${u.receiver}.${u.operation}` +
        `${u.target ? ` "${u.target}"` : ""} in ${u.enclosingSymbol}#${u.ordinal}`,
    ),
  );
  emitViolationBlock(
    lines,
    "active direct entr(y/ies) with no matching source call site (remove the entry in the same change)",
    rec.directOrphaned.map(
      (o) =>
        `  - id ${o.id}: ${o.path}:${o.line} [${o.category}] ${o.receiver}.${o.operation}` +
        `${o.target ? ` "${o.target}"` : ""} in ${o.enclosingSymbol}#${o.ordinal}`,
    ),
  );
  emitViolationBlock(
    lines,
    "NEW dependency site(s) not in the active allowlist",
    rec.dependencyUnlisted.map(
      (u) =>
        `  + ${u.path}:${u.line} [${u.category}] ${u.symbol} in ${u.enclosingSymbol}#${u.ordinal}`,
    ),
  );
  emitViolationBlock(
    lines,
    "active dependency entr(y/ies) with no matching source site",
    rec.dependencyOrphaned.map(
      (o) =>
        `  - id ${o.id}: ${o.path}:${o.line} [${o.category}] ${o.symbol} in ${o.enclosingSymbol}#${o.ordinal}`,
    ),
  );

  if (rec.ok && structure.ok) {
    lines.push(
      `OK: ${scan.direct.length} direct + ${scan.dependency.length} dependency sites match the frozen baseline.`,
    );
  }
  return lines.join("\n") + "\n";
}

function emitViolationBlock(lines: string[], title: string, entries: string[]): void {
  if (entries.length === 0) return;
  lines.push(`FAIL: ${entries.length} ${title}.`);
  for (const e of entries.slice(0, 100)) lines.push(e);
  lines.push("");
}

/* ==========================================================================
 * CLI.
 * ======================================================================== */

function argValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
}

function runCheck(root: string): number {
  const scan = scanRepo(root);
  const allow = loadAllowlist(join(root, ALLOWLIST_RELATIVE_PATH));
  const structure = validateStructure(allow);
  const rec = reconcile(scan, allow);
  process.stdout.write(formatReport(scan, allow, structure, rec));
  return rec.ok && structure.ok ? 0 : 1;
}

function runRatchet(root: string, ref: string): number {
  const scan = scanRepo(root);
  const head = loadAllowlist(join(root, ALLOWLIST_RELATIVE_PATH));
  const base = readBaseAllowlist(ref, root);
  const rec = reconcile(scan, head);
  const structure = validateStructure(head);
  const ratchet = compareRatchet(base, head);
  const out: string[] = [];
  out.push(`Ratchet comparison against base ref: ${ref}`);
  out.push(base === null ? "base allowlist: ABSENT -> bootstrap mode" : "base allowlist: present");
  out.push(`bootstrap: ${ratchet.bootstrap}`);
  if (!structure.ok) for (const i of structure.issues) out.push(`  structure: ${i}`);
  if (!rec.ok)
    out.push("  head allowlist does not reconcile with current source (see guard output)");
  for (const i of ratchet.issues) out.push(`  ratchet: ${i}`);
  out.push(ratchet.ok && rec.ok && structure.ok ? "RATCHET OK" : "RATCHET FAIL");
  process.stdout.write(out.join("\n") + "\n");
  return ratchet.ok && rec.ok && structure.ok ? 0 : 1;
}

function main(argv: string[]): number {
  const root = process.cwd();
  if (argv.includes("--emit")) {
    process.stdout.write(serializeAllowlist(buildAllowlist(scanRepo(root))));
    return 0;
  }
  const ratchetRef = argValue(argv, "--ratchet-base");
  if (ratchetRef) return runRatchet(root, ratchetRef);
  return runCheck(root);
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
