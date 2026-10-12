import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily free-plan job (called by the database scheduler at 00:05 Bangkok).
 * It only does what is already due — 14-day reminders and ending overdue free plans,
 * each email at most once — so a call from anyone else changes nothing early. Returns counts only.
 */
export const Route = createFileRoute("/api/public/free-plan-job")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runFreePlanJob } = await import("@/lib/free-plan.server");
        const r = await runFreePlanJob(supabaseAdmin as any);
        return Response.json(r, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
