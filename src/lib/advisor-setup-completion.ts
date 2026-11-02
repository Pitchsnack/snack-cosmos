/**
 * Setup-completion guard for advisor firm saves.
 *
 * Control (Admin) may edit any firm from the Admin panel, but that edit must
 * never mark another person's draft as "setup completed". The owner's own save
 * always keeps its setup_done_at stamp.
 */
export function shouldProtectSetupDone(
  ownerUserId: string | null | undefined,
  callerUserId: string,
): boolean {
  return !!ownerUserId && ownerUserId !== callerUserId;
}
