import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function adminInviteUserByEmail(
  email: string,
  redirectTo: string,
  metadata?: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: metadata,
  });
  if (error) throw new Error(error.message);
  // Accounts Admin makes skip sign-up.
  if (data.user?.id) await (supabaseAdmin as any).from("users").update({ signup_done_at: new Date().toISOString() }).eq("id", data.user.id).is("signup_done_at", null);
  return data.user;
}
