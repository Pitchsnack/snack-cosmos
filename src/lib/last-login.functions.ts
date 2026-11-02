import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Stamps the caller's own last-active time (public.user_activity via the
 * touch_last_active() RPC, throttled to once every 15 minutes server-side).
 * The browser never sends a time. Called on sign-in and when the app opens
 * or comes back into focus with a valid session.
 */
export const touchLastActive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any).rpc('touch_last_active');
    if (error) throw new Error(error.message);
    return { ok: true };
  });
