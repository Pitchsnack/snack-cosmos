
-- Lock down helper functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_control(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_master_agent_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_in_tenant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.active_tenant_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_control(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_agent_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_tenant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.active_tenant_id(uuid) TO authenticated, service_role;

-- Tighten INSERT WITH CHECKs
DROP POLICY IF EXISTS prd2_audit_logs_insert ON public.audit_logs;
CREATE POLICY prd2_audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid() OR performed_by IS NULL);

DROP POLICY IF EXISTS prd2_security_events_insert ON public.security_events;
CREATE POLICY prd2_security_events_insert ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_control(auth.uid()));
