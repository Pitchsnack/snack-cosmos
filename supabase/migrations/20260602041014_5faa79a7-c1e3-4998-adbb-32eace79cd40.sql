CREATE TRIGGER tg_startup_ownership_tenant_match
BEFORE INSERT OR UPDATE ON public.startup_ownership
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();

CREATE TRIGGER tg_startup_ai_ownership_tenant_match
BEFORE INSERT OR UPDATE ON public.startup_ai_ownership
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();

CREATE TRIGGER tg_startup_activity_tenant_match
BEFORE INSERT OR UPDATE ON public.startup_activity
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();