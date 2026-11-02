import { lastLoginStepOf, type LastLoginStep } from '@/lib/last-login';

/**
 * Server-only last-login steps. Reads public.user_activity with the service
 * client and returns only the bucketed step per entity — never a timestamp
 * or which user it was.
 */

async function activityByUser(sb: any, userIds: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await sb.from('user_activity').select('user_id, last_active_at').in('user_id', uniq);
  return new Map(((data ?? []) as { user_id: string; last_active_at: string }[]).map((r) => [r.user_id, r.last_active_at]));
}

function latestStep(rows: Map<string, string>, userIds: string[]): LastLoginStep | null {
  let best: string | null = null;
  for (const id of userIds) {
    const ts = rows.get(id);
    if (ts && (!best || ts > best)) best = ts;
  }
  return lastLoginStepOf(best);
}

/** Listing cards: the latest activity of the startup's owner and team. */
export async function startupLoginSteps(sb: any, startupIds: string[]): Promise<Map<string, LastLoginStep | null>> {
  const ids = [...new Set(startupIds.filter(Boolean))];
  const out = new Map<string, LastLoginStep | null>();
  if (!ids.length) return out;
  const { data: members } = await sb.from('startup_users').select('startup_id, user_id').in('startup_id', ids);
  const byStartup = new Map<string, string[]>();
  for (const m of (members ?? []) as { startup_id: string; user_id: string }[]) {
    byStartup.set(m.startup_id, [...(byStartup.get(m.startup_id) ?? []), m.user_id]);
  }
  const activity = await activityByUser(sb, (members ?? []).map((m: { user_id: string }) => m.user_id));
  for (const id of ids) out.set(id, latestStep(activity, byStartup.get(id) ?? []));
  return out;
}

/** Investor cards: the buyer profile's own account. */
export async function investorLoginSteps(sb: any, userIds: string[]): Promise<Map<string, LastLoginStep | null>> {
  const activity = await activityByUser(sb, userIds);
  const out = new Map<string, LastLoginStep | null>();
  for (const id of new Set(userIds.filter(Boolean))) out.set(id, latestStep(activity, [id]));
  return out;
}

/** Firm cards: the firm's owner account. */
export async function firmLoginSteps(sb: any, ownerIds: (string | null)[]): Promise<Map<string, LastLoginStep | null>> {
  const activity = await activityByUser(sb, ownerIds.filter((x): x is string => !!x));
  const out = new Map<string, LastLoginStep | null>();
  for (const id of new Set(ownerIds.filter((x): x is string => !!x))) out.set(id, latestStep(activity, [id]));
  return out;
}
