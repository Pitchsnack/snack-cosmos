import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CODE_RE, addDays, bkkToday, makeCode } from './access-codes';

// Admin-only: verify the caller through their own client, then use the service client.
async function admin(context: any) {
  const { data, error } = await context.supabase.rpc('is_control', { _user_id: context.userId });
  if (error || !data) throw new Error('Only admins can manage access codes');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin as any;
}

export const getAccessCodes = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = await admin(context);
  const [codes, devices, settings, plans, users] = await Promise.all([
    sb.from('access_codes').select('*').order('created_at', { ascending: false }),
    sb.from('access_devices').select('code_id,visits,last_seen_at'),
    sb.from('soft_launch_settings').select('*').eq('id', true).single(),
    sb.from('plans').select('role,key,name,status,price_type,sort').order('sort'),
    sb.from('users').select('id,email,first_name,last_name,created_at,access_code_id').not('access_code_id', 'is', null),
  ]);
  for (const r of [codes, devices, settings, plans, users]) if (r.error) throw new Error(r.error.message);
  const ids = (users.data ?? []).map((u: any) => u.id);
  const subs = ids.length ? (await sb.from('subscriptions').select('user_id,status,term_end,source,access_code_id,plan_id,plans(name)').in('user_id', ids)).data ?? [] : [];
  const adminIds = Array.from(new Set((codes.data ?? []).flatMap((c: any) => [c.created_by, c.switched_off_by, c.invite_sent_by]).concat(settings.data?.changed_by).filter(Boolean)));
  const admins = adminIds.length ? (await sb.from('users').select('id,email,first_name,last_name').in('id', adminIds)).data ?? [] : [];
  return { codes: codes.data, devices: devices.data, settings: settings.data, plans: plans.data, accounts: users.data, subs, admins };
});

export const setSoftLaunchGate = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ on: z.boolean() }).parse(d)).handler(async ({ data, context }) => {
    const sb = await admin(context);
    const { error } = await sb.from('soft_launch_settings').update({ gate_on: data.on, changed_at: new Date().toISOString(), changed_by: context.userId }).eq('id', true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const newAccessCode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = await admin(context);
  for (let i = 0; i < 10; i++) { const c = makeCode(); const { data } = await sb.from('access_codes').select('id').eq('code', c).maybeSingle(); if (!data) return { code: c }; }
  throw new Error('Could not make a unique code');
});

export const createAccessCode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    code: z.string().regex(CODE_RE), client: z.string().trim().min(1).max(200), email: z.string().trim().email().max(255).nullable(),
    role: z.enum(['seller', 'buyer', 'advisor', 'any']), freePlan: z.string().max(40).nullable(), months: z.number().int().min(1).max(12),
    max: z.number().int().min(1).max(50), endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), note: z.string().max(2000).nullable(),
  }).parse(d)).handler(async ({ data, context }) => {
    const sb = await admin(context);
    if (data.endsOn && data.endsOn <= bkkToday()) throw new Error('Pick a date from tomorrow on.');
    if (data.freePlan) {
      if (data.role === 'any') { if (data.freePlan !== 'usual') throw new Error('Pick a free plan'); }
      else { const { data: p } = await sb.from('plans').select('key').eq('role', data.role).eq('key', data.freePlan).eq('status', 'live').neq('price_type', 'free').maybeSingle(); if (!p) throw new Error('That plan isn’t live any more'); }
    }
    let code = data.code;
    for (let i = 0; i < 10; i++) {
      const { data: row, error } = await sb.from('access_codes').insert({ code, client_name: data.client, invite_email: data.email, role: data.role, free_plan: data.freePlan, free_months: data.months, max_accounts: data.max, ends_on: data.endsOn, note: data.note, created_by: context.userId }).select('*').single();
      if (!error) return row;
      if (error.code !== '23505') throw new Error(error.message);
      code = makeCode();
    }
    throw new Error('Could not save a unique code');
  });

export const updateAccessCode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), action: z.enum(['extend', 'more', 'off', 'on']) }).parse(d)).handler(async ({ data, context }) => {
    const sb = await admin(context);
    const { data: c, error } = await sb.from('access_codes').select('*').eq('id', data.id).single();
    if (error) throw new Error(error.message);
    const today = bkkToday(); let patch: Record<string, unknown> = {};
    if (data.action === 'extend') patch = { ends_on: addDays(c.ends_on && c.ends_on > today ? c.ends_on : today, 30) };
    if (data.action === 'more') { if (c.max_accounts >= 50) throw new Error('A code can make at most 50 accounts'); patch = { max_accounts: c.max_accounts + 1 }; }
    if (data.action === 'off') patch = { switched_off_at: new Date().toISOString(), switched_off_by: context.userId };
    if (data.action === 'on') patch = { switched_off_at: null, switched_off_by: null, ...(c.ends_on && c.ends_on < today ? { ends_on: addDays(today, 30) } : {}) };
    const { data: row, error: e2 } = await sb.from('access_codes').update(patch).eq('id', data.id).select('*').single();
    if (e2) throw new Error(e2.message);
    return row;
  });
