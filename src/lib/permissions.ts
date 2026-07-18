// PRD 2 — Application-owned RBAC. Do NOT use vendor (Supabase/Lovable) roles
// or permissions. This map is the single source of truth.

export type AppRole =
  | "CONTROL"
  | "CONTROL_RESEARCH_AI"
  | "CONTROL_STARTUP_DISCOVERY_AI"
  | "CONTROL_INVESTOR_DISCOVERY_AI"
  | "MASTER_AGENT"
  | "MASTER_AGENT_AI"
  | "TENANT_ADMIN"
  | "TENANT_AGENT"
  | "TENANT_STARTUP_AI"
  | "TENANT_INVESTOR_AI"
  | "TENANT_DEAL_AI"
  | "STARTUP_USER"
  | "INVESTOR_USER";

export type Permission =
  | "tenants.read"
  | "tenants.write"
  | "tenants.delete"
  | "users.read"
  | "users.invite"
  | "users.suspend"
  | "users.assign_role"
  | "roles.read"
  | "roles.assign"
  | "security.read"
  | "audit.read"
  | "workspace.switch"
  | "startups.read"
  | "startups.write"
  | "investors.read"
  | "investors.write"
  | "deals.read"
  | "deals.write"
  | "deals.share.read"
  | "deals.share.create"
  | "deals.share.accept"
  | "deals.share.reject"
  | "deals.share.introduce"
  | "global_startups.read"
  | "global_startups.write"
  | "global_startups.import"
  | "ai.invoke"
  | "default_intake.read"
  | "default_intake.write"
  | "default_intake.reassign"
  | "default_intake.agent.create";


const ALL: Permission[] = [
  "tenants.read","tenants.write","tenants.delete",
  "users.read","users.invite","users.suspend","users.assign_role",
  "roles.read","roles.assign",
  "security.read","audit.read","workspace.switch",
  "startups.read","startups.write",
  "investors.read","investors.write",
  "deals.read","deals.write",
  "deals.share.read","deals.share.create","deals.share.accept","deals.share.reject","deals.share.introduce",
  "global_startups.read","global_startups.write",
  "ai.invoke",
  "default_intake.read","default_intake.write","default_intake.reassign","default_intake.agent.create",
];


const TENANT_ADMIN: Permission[] = [
  "tenants.read",
  "users.read","users.invite","users.suspend","users.assign_role",
  "roles.read","roles.assign",
  "security.read","audit.read","workspace.switch",
  "startups.read","startups.write",
  "investors.read","investors.write",
  "deals.read","deals.write",
  "deals.share.read","deals.share.create","deals.share.accept","deals.share.reject","deals.share.introduce",
  "global_startups.read","global_startups.import",
];

const TENANT_AGENT: Permission[] = [
  "tenants.read","workspace.switch",
  "startups.read","startups.write",
  "investors.read","investors.write",
  "deals.read","deals.write",
  "deals.share.read","deals.share.create","deals.share.accept","deals.share.reject","deals.share.introduce",
  "global_startups.read","global_startups.import",
];

const STARTUP_USER: Permission[] = ["workspace.switch","startups.read"];
const INVESTOR_USER: Permission[] = ["workspace.switch","investors.read"];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  CONTROL: ALL,
  CONTROL_RESEARCH_AI: [...ALL, "ai.invoke"],
  CONTROL_STARTUP_DISCOVERY_AI: ["startups.read","startups.write","ai.invoke"],
  CONTROL_INVESTOR_DISCOVERY_AI: ["investors.read","investors.write","ai.invoke"],
  MASTER_AGENT: TENANT_ADMIN,
  MASTER_AGENT_AI: [...TENANT_ADMIN, "ai.invoke"],
  TENANT_ADMIN,
  TENANT_AGENT,
  TENANT_STARTUP_AI: [...TENANT_AGENT, "ai.invoke"],
  TENANT_INVESTOR_AI: [...TENANT_AGENT, "ai.invoke"],
  TENANT_DEAL_AI: [...TENANT_AGENT, "ai.invoke"],
  STARTUP_USER,
  INVESTOR_USER,
};

export function can(role: AppRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function canAny(roles: AppRole[], perm: Permission): boolean {
  return roles.some((r) => can(r, perm));
}

export const ROLE_LABELS: Record<AppRole, string> = {
  CONTROL: "Control Admin",
  CONTROL_RESEARCH_AI: "Research AI",
  CONTROL_STARTUP_DISCOVERY_AI: "Startup Discovery AI",
  CONTROL_INVESTOR_DISCOVERY_AI: "Investor Discovery AI",
  MASTER_AGENT: "Master Agent",
  MASTER_AGENT_AI: "Master Agent AI",
  TENANT_ADMIN: "Tenant Admin",
  TENANT_AGENT: "Tenant Agent",
  TENANT_STARTUP_AI: "Tenant Startup AI",
  TENANT_INVESTOR_AI: "Tenant Investor AI",
  TENANT_DEAL_AI: "Tenant Deal AI",
  STARTUP_USER: "Startup User",
  INVESTOR_USER: "Investor User",
};
