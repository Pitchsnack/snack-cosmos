-- One store of DBD data per 13-digit registration number, shared by sellers, buyers and advisors.
CREATE TABLE public.dbd_company_records (
  registration_number text PRIMARY KEY CHECK (registration_number ~ '^\d{13}$'),
  source text NOT NULL DEFAULT 'dbd' CHECK (source IN ('dbd','manual')),
  source_note text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  retrieved_by uuid,
  entered_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dbd_company_records TO authenticated;
GRANT ALL ON public.dbd_company_records TO service_role;
ALTER TABLE public.dbd_company_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY dbd_records_control_read ON public.dbd_company_records FOR SELECT TO authenticated USING (public.is_control(auth.uid()));

CREATE TABLE public.dbd_fetch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  action text NOT NULL CHECK (action IN ('extract','refresh','delete','manual_save','link_existing')),
  result text NOT NULL CHECK (result IN ('ok','not_found','failed')),
  error text,
  actor_id uuid,
  source text,
  old_retrieved_at timestamptz,
  new_retrieved_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dbd_fetch_logs_reg_idx ON public.dbd_fetch_logs (registration_number, created_at DESC);
GRANT SELECT ON public.dbd_fetch_logs TO authenticated;
GRANT ALL ON public.dbd_fetch_logs TO service_role;
ALTER TABLE public.dbd_fetch_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dbd_logs_control_read ON public.dbd_fetch_logs FOR SELECT TO authenticated USING (public.is_control(auth.uid()));

CREATE TABLE public.analyst_statement_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  fiscal_year integer NOT NULL,
  statement text NOT NULL CHECK (statement IN ('income','position','cash_flow','ratio')),
  item_code text NOT NULL,
  original_amount numeric,
  edited_amount numeric,
  edited_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_number, fiscal_year, statement, item_code)
);
GRANT SELECT ON public.analyst_statement_edits TO authenticated;
GRANT ALL ON public.analyst_statement_edits TO service_role;
ALTER TABLE public.analyst_statement_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY analyst_edits_control_read ON public.analyst_statement_edits FOR SELECT TO authenticated USING (public.is_control(auth.uid()));

ALTER TABLE public.financial_statements ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.approval_events ADD COLUMN IF NOT EXISTS dbd_source text;
ALTER TABLE public.approval_events ADD COLUMN IF NOT EXISTS dbd_retrieved_at timestamptz;

CREATE OR REPLACE FUNCTION public.dbd_norm_reg(_s text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT nullif(regexp_replace(coalesce(_s,''), '\D', '', 'g'), '') $$;

CREATE OR REPLACE FUNCTION public.dbd_locked_startup(_sid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM startups s JOIN dbd_company_records r ON r.registration_number = public.dbd_norm_reg(s.registered_number) WHERE s.id = _sid)
$$;

-- Guard: stored DBD rows change only inside dbd_store_save / dbd_store_delete / dbd_apply_edit.
CREATE OR REPLACE FUNCTION public.tg_dbd_store_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF current_setting('app.dbd_write', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'dbd_company_records' THEN
    RAISE EXCEPTION 'Stored DBD data is read-only. Only a Control Admin can refresh, delete or enter it.';
  END IF;
  IF TG_OP = 'DELETE' THEN sid := OLD.startup_id; ELSE sid := NEW.startup_id; END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'financial_statements'
     AND (to_jsonb(NEW) - ARRAY['verified_status','updated_at']) = (to_jsonb(OLD) - ARRAY['verified_status','updated_at']) THEN
    RETURN NEW;
  END IF;
  IF public.dbd_locked_startup(sid) THEN
    RAISE EXCEPTION 'Stored DBD data is read-only. Only a Control Admin can refresh, delete or enter it.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;

CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.dbd_company_records FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_info_th FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_director_th FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_financial_submission_year_th FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_registered_business_th FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_latest_business_th FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_statements FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.income_statement_items FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_position_items FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cash_flow_items FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();
CREATE TRIGGER zz_dbd_store_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_ratios FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_store_guard();

-- Company identity fields follow the store: other writers keep the stored values.
CREATE OR REPLACE FUNCTION public.tg_dbd_identity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.dbd_write', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'startups' THEN
    IF EXISTS (SELECT 1 FROM dbd_company_records r WHERE r.registration_number = public.dbd_norm_reg(NEW.registered_number)) THEN
      NEW.registered_name := OLD.registered_name; NEW.registered_capital := OLD.registered_capital;
      NEW.registered_date := OLD.registered_date; NEW.registered_status := OLD.registered_status;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM dbd_company_records r WHERE r.registration_number = public.dbd_norm_reg(NEW.registration_no)) THEN
      NEW.dbd_name := OLD.dbd_name; NEW.dbd_status := OLD.dbd_status; NEW.dbd_registered_on := OLD.dbd_registered_on;
      NEW.dbd_capital := OLD.dbd_capital; NEW.dbd_checked_at := OLD.dbd_checked_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_dbd_identity_guard BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_identity_guard();
CREATE TRIGGER zz_dbd_identity_guard BEFORE UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.tg_dbd_identity_guard();

-- Snapshot of a startup's existing imported rows in the store's data format.
CREATE OR REPLACE FUNCTION public.dbd_snapshot_startup(_sid uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'info', (SELECT to_jsonb(ci) - ARRAY['id','startup_id','tenant_id','created_at','updated_at','manually_edited_at','manually_edited_by'] FROM company_info_th ci WHERE ci.startup_id = _sid),
    'directors', coalesce((SELECT jsonb_agg(d.director_name_th ORDER BY d.display_order) FROM company_director_th d WHERE d.startup_id = _sid AND d.is_active), '[]'::jsonb),
    'submission_years_be', coalesce((SELECT jsonb_agg(y.financial_year_be ORDER BY y.financial_year_be DESC) FROM company_financial_submission_year_th y WHERE y.startup_id = _sid), '[]'::jsonb),
    'registered_business', (SELECT jsonb_build_object('business_code',b.business_code,'business_description_th',b.business_description_th,'business_objective_th',b.business_objective_th) FROM company_registered_business_th b WHERE b.startup_id = _sid LIMIT 1),
    'latest_business', (SELECT jsonb_build_object('financial_year_be',b.financial_year_be,'business_code',b.business_code,'business_description_th',b.business_description_th,'business_objective_th',b.business_objective_th) FROM company_latest_business_th b WHERE b.startup_id = _sid LIMIT 1),
    'statements', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'fiscal_year', f.fiscal_year, 'currency', f.currency, 'source_name', f.source_name, 'source_reference', f.source_reference,
        'retrieved_at', f.retrieved_at, 'matched_registered_number', f.matched_registered_number, 'matched_registered_name', f.matched_registered_name,
        'income', coalesce((SELECT jsonb_agg(jsonb_build_object('item_code',i.item_code,'item_label',i.item_label,'amount',i.amount,'percent_change',i.percent_change,'display_order',i.display_order,'is_total',i.is_total) ORDER BY i.display_order) FROM income_statement_items i WHERE i.financial_statement_id = f.id), '[]'::jsonb),
        'position', coalesce((SELECT jsonb_agg(jsonb_build_object('item_code',i.item_code,'item_label',i.item_label,'amount',i.amount,'percent_change',i.percent_change,'display_order',i.display_order,'is_total',i.is_total) ORDER BY i.display_order) FROM financial_position_items i WHERE i.financial_statement_id = f.id), '[]'::jsonb),
        'cash_flow', coalesce((SELECT jsonb_agg(jsonb_build_object('section',i.section,'item_code',i.item_code,'item_label',i.item_label,'amount',i.amount,'percent_change',i.percent_change,'display_order',i.display_order,'is_total',i.is_total) ORDER BY i.display_order) FROM cash_flow_items i WHERE i.financial_statement_id = f.id), '[]'::jsonb),
        'ratios', coalesce((SELECT jsonb_agg(jsonb_build_object('ratio_category',i.ratio_category,'ratio_code',i.ratio_code,'ratio_label',i.ratio_label,'unit',i.unit,'value',i.value,'display_order',i.display_order,'calculation_source',i.calculation_source) ORDER BY i.display_order) FROM financial_ratios i WHERE i.startup_id = _sid AND i.fiscal_year = f.fiscal_year), '[]'::jsonb)
      ) ORDER BY f.fiscal_year) FROM financial_statements f WHERE f.startup_id = _sid), '[]'::jsonb)
  )
$$;

-- Writes one startup's report tables from the store's data (inside the write window only).
CREATE OR REPLACE FUNCTION public.dbd_materialize(_sid uuid, _reg text, _data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid; ci_id uuid; st jsonb; fs_id uuid; was_verified boolean; info jsonb := _data->'info';
BEGIN
  IF current_setting('app.dbd_write', true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT tenant_id INTO tid FROM startups WHERE id = _sid;
  SELECT EXISTS (SELECT 1 FROM financial_statements WHERE startup_id = _sid AND verified_status = 'verified') INTO was_verified;
  DELETE FROM financial_ratios WHERE startup_id = _sid;
  DELETE FROM financial_statements WHERE startup_id = _sid;
  DELETE FROM company_info_th WHERE startup_id = _sid;
  IF info IS NOT NULL AND jsonb_typeof(info) = 'object' THEN
    ci_id := gen_random_uuid();
    INSERT INTO company_info_th (id, startup_id, tenant_id, legal_name_th, legal_name_en, registration_number, legal_entity_type_th, legal_entity_status_th,
      registration_date, registration_date_th_raw, registered_capital_thb, registered_capital_th_raw, previous_registration_number, business_group_th,
      business_size, head_office_address_th, website, authorized_signatory_th, source_name, source_url, retrieved_at)
    VALUES (ci_id, _sid, tid, info->>'legal_name_th', info->>'legal_name_en', _reg, info->>'legal_entity_type_th', info->>'legal_entity_status_th',
      nullif(info->>'registration_date','')::date, info->>'registration_date_th_raw', nullif(info->>'registered_capital_thb','')::numeric, info->>'registered_capital_th_raw',
      info->>'previous_registration_number', info->>'business_group_th', info->>'business_size', info->>'head_office_address_th', info->>'website',
      info->>'authorized_signatory_th', coalesce(info->>'source_name','DBD Data Warehouse'), info->>'source_url', nullif(info->>'retrieved_at','')::timestamptz);
    INSERT INTO company_director_th (company_info_id, startup_id, tenant_id, display_order, director_name_th)
      SELECT ci_id, _sid, tid, d.ord, d.v FROM jsonb_array_elements_text(coalesce(_data->'directors','[]'::jsonb)) WITH ORDINALITY AS d(v, ord) WHERE trim(d.v) <> '';
    INSERT INTO company_financial_submission_year_th (company_info_id, startup_id, tenant_id, financial_year_be, financial_year_ce, is_latest)
      SELECT ci_id, _sid, tid, y.v::smallint, (y.v::int - 543)::smallint, y.ord = 1 FROM jsonb_array_elements_text(coalesce(_data->'submission_years_be','[]'::jsonb)) WITH ORDINALITY AS y(v, ord);
    IF jsonb_typeof(_data->'registered_business') = 'object' THEN
      INSERT INTO company_registered_business_th (company_info_id, startup_id, tenant_id, business_code, business_description_th, business_objective_th)
      VALUES (ci_id, _sid, tid, _data->'registered_business'->>'business_code', _data->'registered_business'->>'business_description_th', _data->'registered_business'->>'business_objective_th');
    END IF;
    IF jsonb_typeof(_data->'latest_business') = 'object' THEN
      INSERT INTO company_latest_business_th (company_info_id, startup_id, tenant_id, financial_year_be, business_code, business_description_th, business_objective_th)
      VALUES (ci_id, _sid, tid, nullif(_data->'latest_business'->>'financial_year_be','')::smallint, _data->'latest_business'->>'business_code', _data->'latest_business'->>'business_description_th', _data->'latest_business'->>'business_objective_th');
    END IF;
  END IF;
  FOR st IN SELECT * FROM jsonb_array_elements(coalesce(_data->'statements','[]'::jsonb)) LOOP
    fs_id := gen_random_uuid();
    INSERT INTO financial_statements (id, startup_id, tenant_id, fiscal_year, currency, statement_basis, source_name, source_reference, retrieved_at,
      matched_registered_number, matched_registered_name, registration_number, verified_status)
    VALUES (fs_id, _sid, tid, (st->>'fiscal_year')::int, coalesce(st->>'currency','THB'), 'standalone', st->>'source_name', st->>'source_reference',
      nullif(st->>'retrieved_at','')::timestamptz, st->>'matched_registered_number', st->>'matched_registered_name', _reg, CASE WHEN was_verified THEN 'verified' ELSE 'draft' END);
    INSERT INTO income_statement_items (financial_statement_id, startup_id, tenant_id, fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total)
      SELECT fs_id, _sid, tid, (st->>'fiscal_year')::int, i->>'item_code', coalesce(i->>'item_label', i->>'item_code'), nullif(i->>'amount','')::numeric, nullif(i->>'percent_change','')::numeric, coalesce((i->>'display_order')::int, 0), coalesce((i->>'is_total')::boolean, false)
      FROM jsonb_array_elements(coalesce(st->'income','[]'::jsonb)) i;
    INSERT INTO financial_position_items (financial_statement_id, startup_id, tenant_id, fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total)
      SELECT fs_id, _sid, tid, (st->>'fiscal_year')::int, i->>'item_code', coalesce(i->>'item_label', i->>'item_code'), nullif(i->>'amount','')::numeric, nullif(i->>'percent_change','')::numeric, coalesce((i->>'display_order')::int, 0), coalesce((i->>'is_total')::boolean, false)
      FROM jsonb_array_elements(coalesce(st->'position','[]'::jsonb)) i;
    INSERT INTO cash_flow_items (financial_statement_id, startup_id, tenant_id, fiscal_year, section, item_code, item_label, amount, percent_change, display_order, is_total)
      SELECT fs_id, _sid, tid, (st->>'fiscal_year')::int, coalesce(i->>'section','operating'), i->>'item_code', coalesce(i->>'item_label', i->>'item_code'), nullif(i->>'amount','')::numeric, nullif(i->>'percent_change','')::numeric, coalesce((i->>'display_order')::int, 0), coalesce((i->>'is_total')::boolean, false)
      FROM jsonb_array_elements(coalesce(st->'cash_flow','[]'::jsonb)) i;
    INSERT INTO financial_ratios (financial_statement_id, startup_id, tenant_id, fiscal_year, ratio_category, ratio_code, ratio_label, unit, value, display_order, calculation_source)
      SELECT fs_id, _sid, tid, (st->>'fiscal_year')::int, i->>'ratio_category', i->>'ratio_code', coalesce(i->>'ratio_label', i->>'ratio_code'), coalesce(i->>'unit','times'), nullif(i->>'value','')::numeric, coalesce((i->>'display_order')::int, 0), coalesce(i->>'calculation_source','DBD_REPORTED')
      FROM jsonb_array_elements(coalesce(st->'ratios','[]'::jsonb)) i;
  END LOOP;
  -- Analyst edits sit on top of the stored figures.
  UPDATE income_statement_items t SET amount = e.edited_amount FROM analyst_statement_edits e
    WHERE t.startup_id = _sid AND e.registration_number = _reg AND e.statement = 'income' AND e.fiscal_year = t.fiscal_year AND e.item_code = t.item_code;
  UPDATE financial_position_items t SET amount = e.edited_amount FROM analyst_statement_edits e
    WHERE t.startup_id = _sid AND e.registration_number = _reg AND e.statement = 'position' AND e.fiscal_year = t.fiscal_year AND e.item_code = t.item_code;
  UPDATE cash_flow_items t SET amount = e.edited_amount FROM analyst_statement_edits e
    WHERE t.startup_id = _sid AND e.registration_number = _reg AND e.statement = 'cash_flow' AND e.fiscal_year = t.fiscal_year AND e.item_code = t.item_code;
  UPDATE financial_ratios t SET value = e.edited_amount FROM analyst_statement_edits e
    WHERE t.startup_id = _sid AND e.registration_number = _reg AND e.statement = 'ratio' AND e.fiscal_year = t.fiscal_year AND e.item_code = t.ratio_code;
END $$;

-- The only writer of stored DBD data: Extract / Refresh / Save data by hand, by a Control Admin.
CREATE OR REPLACE FUNCTION public.dbd_store_save(_actor uuid, _reg text, _action text, _source text, _source_note text, _data jsonb, _raw jsonb, _actor_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_at timestamptz; new_at timestamptz := now(); s record; sids uuid[] := '{}'; info jsonb := _data->'info';
BEGIN
  IF NOT public.is_control(_actor) THEN RAISE EXCEPTION 'Control Admin only'; END IF;
  IF _reg !~ '^\d{13}$' THEN RAISE EXCEPTION 'A 13-digit registration number is required'; END IF;
  IF _action NOT IN ('extract','refresh','manual_save') OR _source NOT IN ('dbd','manual') THEN RAISE EXCEPTION 'Unknown action'; END IF;
  PERFORM set_config('app.dbd_write', 'on', true);
  SELECT retrieved_at INTO old_at FROM dbd_company_records WHERE registration_number = _reg;
  INSERT INTO dbd_company_records (registration_number, source, source_note, data, raw_payload, retrieved_at, retrieved_by, entered_by_name, updated_at)
  VALUES (_reg, _source, _source_note, _data, _raw, new_at, _actor, _actor_name, new_at)
  ON CONFLICT (registration_number) DO UPDATE SET source = EXCLUDED.source, source_note = EXCLUDED.source_note, data = EXCLUDED.data,
    raw_payload = EXCLUDED.raw_payload, retrieved_at = EXCLUDED.retrieved_at, retrieved_by = EXCLUDED.retrieved_by,
    entered_by_name = EXCLUDED.entered_by_name, updated_at = EXCLUDED.updated_at;
  FOR s IN SELECT id FROM startups WHERE public.dbd_norm_reg(registered_number) = _reg LOOP
    PERFORM public.dbd_materialize(s.id, _reg, _data);
    sids := sids || s.id;
  END LOOP;
  IF info IS NOT NULL AND jsonb_typeof(info) = 'object' THEN
    UPDATE startups SET registered_name = coalesce(info->>'legal_name_th', info->>'legal_name_en', registered_name),
      registered_capital = coalesce(info->>'registered_capital_th_raw', registered_capital),
      registered_date = coalesce(info->>'registration_date', info->>'registration_date_th_raw', registered_date),
      registered_status = coalesce(info->>'legal_entity_status_th', registered_status)
      WHERE public.dbd_norm_reg(registered_number) = _reg;
    UPDATE advisor_firms SET dbd_name = coalesce(info->>'legal_name_th', info->>'legal_name_en'), dbd_status = info->>'legal_entity_status_th',
      dbd_registered_on = nullif(info->>'registration_date','')::date, dbd_capital = nullif(info->>'registered_capital_thb','')::numeric, dbd_checked_at = new_at
      WHERE public.dbd_norm_reg(registration_no) = _reg;
  END IF;
  INSERT INTO dbd_fetch_logs (registration_number, action, result, actor_id, source, old_retrieved_at, new_retrieved_at, note)
  VALUES (_reg, _action, 'ok', _actor, _source, old_at, new_at, _source_note);
  RETURN jsonb_build_object('retrieved_at', new_at, 'old_retrieved_at', old_at, 'startup_ids', to_jsonb(sids));
END $$;

CREATE OR REPLACE FUNCTION public.dbd_store_delete(_actor uuid, _reg text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_at timestamptz; old_src text; sids uuid[];
BEGIN
  IF NOT public.is_control(_actor) THEN RAISE EXCEPTION 'Control Admin only'; END IF;
  PERFORM set_config('app.dbd_write', 'on', true);
  SELECT retrieved_at, source INTO old_at, old_src FROM dbd_company_records WHERE registration_number = _reg;
  IF old_at IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT coalesce(array_agg(id), '{}') INTO sids FROM startups WHERE public.dbd_norm_reg(registered_number) = _reg;
  DELETE FROM financial_ratios WHERE startup_id = ANY (sids);
  DELETE FROM financial_statements WHERE startup_id = ANY (sids);
  DELETE FROM company_info_th WHERE startup_id = ANY (sids);
  DELETE FROM company_report_records WHERE company_id = ANY (sids) AND report_key IN ('statements','pnl','risk','valuation') AND status = 'generated';
  UPDATE advisor_firms SET dbd_name = NULL, dbd_status = NULL, dbd_registered_on = NULL, dbd_capital = NULL, dbd_checked_at = NULL WHERE public.dbd_norm_reg(registration_no) = _reg;
  DELETE FROM dbd_company_records WHERE registration_number = _reg;
  INSERT INTO dbd_fetch_logs (registration_number, action, result, actor_id, source, old_retrieved_at) VALUES (_reg, 'delete', 'ok', _actor, old_src, old_at);
  RETURN jsonb_build_object('ok', true, 'startup_ids', to_jsonb(sids));
END $$;

-- Analyst edit on one statement line: saved in its own row, then applied on top of the stored figure.
CREATE OR REPLACE FUNCTION public.dbd_apply_edit(_actor uuid, _reg text, _year int, _statement text, _code text, _amount numeric, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE orig numeric; st jsonb; key text;
BEGIN
  IF NOT public.is_control(_actor) THEN RAISE EXCEPTION 'Control Admin only'; END IF;
  key := CASE _statement WHEN 'ratio' THEN 'ratios' ELSE _statement END;
  SELECT s INTO st FROM dbd_company_records r, jsonb_array_elements(r.data->'statements') s WHERE r.registration_number = _reg AND (s->>'fiscal_year')::int = _year;
  SELECT nullif(CASE WHEN _statement = 'ratio' THEN i->>'value' ELSE i->>'amount' END, '')::numeric INTO orig
    FROM jsonb_array_elements(coalesce(st->key, '[]'::jsonb)) i WHERE coalesce(i->>'item_code', i->>'ratio_code') = _code;
  IF orig IS NOT DISTINCT FROM _amount THEN
    DELETE FROM analyst_statement_edits WHERE registration_number = _reg AND fiscal_year = _year AND statement = _statement AND item_code = _code;
  ELSE
    INSERT INTO analyst_statement_edits (registration_number, fiscal_year, statement, item_code, original_amount, edited_amount, edited_by, note)
    VALUES (_reg, _year, _statement, _code, orig, _amount, _actor, _note)
    ON CONFLICT (registration_number, fiscal_year, statement, item_code) DO UPDATE SET edited_amount = EXCLUDED.edited_amount, edited_by = EXCLUDED.edited_by, note = EXCLUDED.note, updated_at = now();
  END IF;
  PERFORM set_config('app.dbd_write', 'on', true);
  IF _statement = 'income' THEN UPDATE income_statement_items t SET amount = _amount FROM startups s WHERE s.id = t.startup_id AND public.dbd_norm_reg(s.registered_number) = _reg AND t.fiscal_year = _year AND t.item_code = _code;
  ELSIF _statement = 'position' THEN UPDATE financial_position_items t SET amount = _amount FROM startups s WHERE s.id = t.startup_id AND public.dbd_norm_reg(s.registered_number) = _reg AND t.fiscal_year = _year AND t.item_code = _code;
  ELSIF _statement = 'cash_flow' THEN UPDATE cash_flow_items t SET amount = _amount FROM startups s WHERE s.id = t.startup_id AND public.dbd_norm_reg(s.registered_number) = _reg AND t.fiscal_year = _year AND t.item_code = _code;
  ELSE UPDATE financial_ratios t SET value = _amount FROM startups s WHERE s.id = t.startup_id AND public.dbd_norm_reg(s.registered_number) = _reg AND t.fiscal_year = _year AND t.ratio_code = _code;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.dbd_store_save(uuid,text,text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbd_store_delete(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbd_apply_edit(uuid,text,int,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbd_materialize(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbd_snapshot_startup(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dbd_store_save(uuid,text,text,text,text,jsonb,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dbd_store_delete(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dbd_apply_edit(uuid,text,int,text,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dbd_snapshot_startup(uuid) TO service_role;

-- Link data already fetched (no new scrape): the five sellers and ADV-1001.
DO $$
DECLARE s record;
BEGIN
  PERFORM set_config('app.dbd_write', 'on', true);
  FOR s IN SELECT st.id, public.dbd_norm_reg(st.registered_number) AS reg, ci.retrieved_at
           FROM startups st JOIN company_info_th ci ON ci.startup_id = st.id
           WHERE public.dbd_norm_reg(st.registered_number) ~ '^\d{13}$' LOOP
    INSERT INTO dbd_company_records (registration_number, source, source_note, data, raw_payload, retrieved_at)
    VALUES (s.reg, 'dbd', 'DBD Data Warehouse (fetched before the shared store)', public.dbd_snapshot_startup(s.id), NULL, coalesce(s.retrieved_at, now()))
    ON CONFLICT (registration_number) DO NOTHING;
    UPDATE financial_statements SET registration_number = s.reg WHERE startup_id = s.id;
    INSERT INTO dbd_fetch_logs (registration_number, action, result, source, new_retrieved_at, note)
    VALUES (s.reg, 'link_existing', 'ok', 'dbd', coalesce(s.retrieved_at, now()), 'Existing DBD data linked; not scraped again');
  END LOOP;
  INSERT INTO dbd_company_records (registration_number, source, source_note, data, retrieved_at)
  SELECT public.dbd_norm_reg(f.registration_no), 'dbd', 'DBD registry check (fetched before the shared store)',
    jsonb_build_object('info', jsonb_build_object('legal_name_th', f.dbd_name, 'legal_entity_status_th', f.dbd_status, 'registration_date', f.dbd_registered_on,
      'registered_capital_thb', f.dbd_capital, 'source_name', 'DBD Data Warehouse'), 'directors', '[]'::jsonb, 'submission_years_be', '[]'::jsonb, 'statements', '[]'::jsonb),
    f.dbd_checked_at
  FROM advisor_firms f WHERE f.dbd_checked_at IS NOT NULL AND public.dbd_norm_reg(f.registration_no) ~ '^\d{13}$'
  ON CONFLICT (registration_number) DO NOTHING;
  INSERT INTO dbd_fetch_logs (registration_number, action, result, source, new_retrieved_at, note)
  SELECT public.dbd_norm_reg(f.registration_no), 'link_existing', 'ok', 'dbd', f.dbd_checked_at, 'Existing advisor registry check linked; not scraped again'
  FROM advisor_firms f WHERE f.dbd_checked_at IS NOT NULL AND public.dbd_norm_reg(f.registration_no) ~ '^\d{13}$';
END $$;