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
  return data.user;
}
