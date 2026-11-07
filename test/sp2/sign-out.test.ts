import { describe, expect, it } from 'bun:test';
import { handleSignedOut, isMenuSigningOut, signOutFromMenu } from '../../src/lib/sign-out';

function fixture() {
  const calls: string[] = [];
  const destinations: unknown[] = [];
  const actions = {
    setBusy: (busy: boolean) => { calls.push(`busy:${busy}`); },
    recordLogout: async () => { calls.push('audit'); },
    cancelQueries: async () => { calls.push('cancel'); },
    signOut: async (): Promise<{ error: unknown }> => { calls.push('logout'); return { error: null }; },
    clear: () => { calls.push('clear'); },
    navigate: async (options: unknown) => { destinations.push(options); calls.push('navigate'); },
    success: () => { calls.push('success'); },
    error: () => { calls.push('error'); },
    logAuditError: () => { calls.push('audit-error'); },
  };
  return { calls, destinations, actions };
}

describe('menu sign-out', () => {
  it('pauses mounted query refetches until login navigation completes, then restores network state', async () => {
    const f = fixture();
    await signOutFromMenu({ ...f.actions, pauseQueries: () => { f.calls.push('pause'); }, resumeQueries: () => { f.calls.push('resume'); } });
    expect(f.calls).toEqual(['busy:true', 'audit', 'cancel', 'pause', 'logout', 'clear', 'navigate', 'success', 'resume', 'busy:false']);
  });
  it('logs while signed in, cancels before logout, clears, replaces login without redirect, then toasts', async () => {
    const f = fixture();
    await signOutFromMenu(f.actions);
    expect(f.calls).toEqual(['busy:true', 'audit', 'cancel', 'logout', 'clear', 'navigate', 'success', 'busy:false']);
    expect(f.destinations).toEqual([{ to: '/login', replace: true, search: { redirect: undefined } }]);
    expect(isMenuSigningOut()).toBe(false);
  });
  it('ignores concurrent selection: exactly one audit and one logout', async () => {
    const f = fixture();
    await Promise.all([signOutFromMenu(f.actions), signOutFromMenu(f.actions)]);
    expect(f.calls.filter(c => c === 'audit')).toHaveLength(1);
    expect(f.calls.filter(c => c === 'logout')).toHaveLength(1);
  });
  it('continues to logout if audit recording rejects', async () => {
    const f = fixture();
    f.actions.recordLogout = async () => { throw new Error('audit unavailable'); };
    await signOutFromMenu(f.actions);
    expect(f.calls).toContain('audit-error');
    expect(f.calls).toContain('logout');
    expect(f.calls).toContain('success');
  });
  it('auth returned error keeps cache/page, shows error and permits retry', async () => {
    const f = fixture();
    f.actions.signOut = async () => ({ error: new Error('offline') });
    await signOutFromMenu(f.actions);
    expect(f.calls).toEqual(['busy:true', 'audit', 'cancel', 'error', 'busy:false']);
    expect(f.destinations).toEqual([]);
    expect(isMenuSigningOut()).toBe(false);
    f.actions.signOut = async () => ({ error: null });
    await signOutFromMenu(f.actions);
    expect(f.calls).toContain('success');
  });
  it('auth thrown error also keeps cache and page', async () => {
    const f = fixture();
    f.actions.signOut = async () => { throw new Error('network'); };
    await signOutFromMenu(f.actions);
    expect(f.calls).not.toContain('clear');
    expect(f.calls).not.toContain('navigate');
    expect(f.calls).toContain('error');
  });
  it('menu auth event cancels/clears without invalidating protected route', async () => {
    const f = fixture();
    f.actions.signOut = async () => {
      expect(isMenuSigningOut()).toBe(true);
      await handleSignedOut({ cancelQueries: async () => { f.calls.push('event-cancel'); }, clear: () => { f.calls.push('event-clear'); }, invalidateRouter: () => { f.calls.push('invalidate'); } });
      return { error: null };
    };
    await signOutFromMenu(f.actions);
    expect(f.calls).toContain('event-clear');
    expect(f.calls).not.toContain('invalidate');
  });
  it('external session ending cancels, clears, then invalidates so guard preserves redirect-back', async () => {
    const calls: string[] = [];
    await handleSignedOut({ cancelQueries: async () => { calls.push('cancel'); }, clear: () => { calls.push('clear'); }, invalidateRouter: () => { calls.push('invalidate'); } });
    expect(calls).toEqual(['cancel', 'clear', 'invalidate']);
  });
});