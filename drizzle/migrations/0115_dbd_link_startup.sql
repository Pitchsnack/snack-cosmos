ALTER TABLE public.dbd_fetch_logs ADD COLUMN IF NOT EXISTS startup_id uuid;
CREATE INDEX IF NOT EXISTS dbd_fetch_logs_startup_idx ON public.dbd_fetch_logs (startup_id, created_at DESC);

-- Use stored data: link one company to the record already stored for its registration number. No DBD fetch.
CREATE OR REPLACE FUNCTION public.dbd_link_startup(_actor uuid, _sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reg text; rec record; info jsonb;
BEGIN
  IF NOT public.is_control(_actor) THEN RAISE EXCEPTION 'Control Admin only'; END IF;
  SELECT public.dbd_norm_reg(registered_number) INTO reg FROM startups WHERE id = _sid;
  IF reg IS NULL OR reg !~ '^\d{13}$' THEN RAISE EXCEPTION 'A 13-digit registration number is required'; END IF;
  SELECT * INTO rec FROM dbd_company_records WHERE registration_number = reg;
  IF rec IS NULL THEN RAISE EXCEPTION 'Nothing is stored for this registration number'; END IF;
  PERFORM set_config('app.dbd_write', 'on', true);
  PERFORM public.dbd_materialize(_sid, reg, rec.data);
  info := rec.data->'info';
  IF info IS NOT NULL AND jsonb_typeof(info) = 'object' THEN
    UPDATE startups SET registered_name = coalesce(info->>'legal_name_th', info->>'legal_name_en', registered_name),
      registered_capital = coalesce(info->>'registered_capital_th_raw', registered_capital),
      registered_date = coalesce(info->>'registration_date', info->>'registration_date_th_raw', registered_date),
      registered_status = coalesce(info->>'legal_entity_status_th', registered_status)
    WHERE id = _sid;
  END IF;
  INSERT INTO dbd_fetch_logs (registration_number, action, result, actor_id, source, old_retrieved_at, new_retrieved_at, note, startup_id)
  VALUES (reg, 'link_existing', 'ok', _actor, rec.source, rec.retrieved_at, rec.retrieved_at, 'Reused from the store, not fetched again', _sid);
  RETURN jsonb_build_object('retrieved_at', rec.retrieved_at, 'registration_number', reg);
END $$;
REVOKE ALL ON FUNCTION public.dbd_link_startup(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dbd_link_startup(uuid, uuid) TO service_role;