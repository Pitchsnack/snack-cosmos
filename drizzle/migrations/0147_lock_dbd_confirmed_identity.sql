CREATE OR REPLACE FUNCTION public.locked_identity_changes(_table text, _old jsonb, _new jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE cols text[]; c text; o text; n text; out jsonb := '{}'::jsonb;
BEGIN
  cols := CASE _table
    WHEN 'startups' THEN ARRAY['registered_number','startup_name','year_founded','thai_name','english_name']
    WHEN 'advisor_firms' THEN ARRAY['registration_no','name','year_founded','thai_name','english_name']
    ELSE ARRAY['registration_no','investor_name','year_founded','thai_name','english_name'] END;
  FOREACH c IN ARRAY cols LOOP
    o := nullif(btrim(_old->>c), ''); n := nullif(btrim(_new->>c), '');
    IF o IS NOT NULL AND o IS DISTINCT FROM n THEN
      out := out || jsonb_build_object(c, jsonb_build_object('old', o, 'new', n));
    END IF;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.guard_locked_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch jsonb;
BEGIN
  IF OLD.reg_locked_at IS NULL THEN RETURN NEW; END IF;
  IF current_setting('app.dbd_write', true) = 'on' THEN RETURN NEW; END IF;
  ch := public.locked_identity_changes(TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW));
  IF ch = '{}'::jsonb THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_control(auth.uid()) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'These details are confirmed with the official DBD record, so they''re locked. Only PitchSnack Admin can change them.';
END $$;

CREATE OR REPLACE FUNCTION public.audit_locked_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch jsonb;
BEGIN
  IF OLD.reg_locked_at IS NULL OR auth.uid() IS NULL THEN RETURN NULL; END IF;
  ch := public.locked_identity_changes(TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW));
  IF ch = '{}'::jsonb THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs (tenant_id, entity_type, entity_id, action, performed_by, old_value, new_value)
  SELECT nullif(to_jsonb(NEW)->>'tenant_id','')::uuid, TG_TABLE_NAME, NEW.id, 'locked_identity_changed', auth.uid(),
         jsonb_object_agg(k, v->'old'), jsonb_object_agg(k, v->'new')
  FROM jsonb_each(ch) AS e(k, v);
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.guard_locked_identity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_locked_identity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER zz_guard_locked_identity BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.guard_locked_identity();
CREATE TRIGGER zz_guard_locked_identity BEFORE UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.guard_locked_identity();
CREATE TRIGGER zz_guard_locked_identity BEFORE UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.guard_locked_identity();
CREATE TRIGGER zz_audit_locked_identity AFTER UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.audit_locked_identity();
CREATE TRIGGER zz_audit_locked_identity AFTER UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.audit_locked_identity();
CREATE TRIGGER zz_audit_locked_identity AFTER UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.audit_locked_identity();