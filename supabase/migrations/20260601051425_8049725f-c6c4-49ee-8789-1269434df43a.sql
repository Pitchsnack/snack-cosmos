
-- workspace_preferences
CREATE TABLE public.workspace_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
  default_landing_page VARCHAR(255) NOT NULL DEFAULT '/dashboard',
  theme VARCHAR(50) NOT NULL DEFAULT 'system',
  items_per_page INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);
CREATE UNIQUE INDEX workspace_preferences_user_global_uniq
  ON public.workspace_preferences (user_id) WHERE tenant_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_preferences TO authenticated;
GRANT ALL ON public.workspace_preferences TO service_role;
ALTER TABLE public.workspace_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY prd3_workspace_prefs_select ON public.workspace_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd3_workspace_prefs_write ON public.workspace_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_workspace_prefs_updated
  BEFORE UPDATE ON public.workspace_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY prd3_notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd3_notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd3_notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY prd3_notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));

-- notification_preferences
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  system_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY prd3_notif_prefs_select ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd3_notif_prefs_write ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notif_prefs_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- saved_searches
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  search_name VARCHAR(255) NOT NULL,
  search_query JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX saved_searches_user_idx ON public.saved_searches (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY prd3_saved_searches_select ON public.saved_searches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd3_saved_searches_write ON public.saved_searches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
