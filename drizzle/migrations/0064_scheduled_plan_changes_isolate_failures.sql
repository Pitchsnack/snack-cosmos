CREATE OR REPLACE FUNCTION public.apply_scheduled_plan_changes() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.plan_changes%ROWTYPE; n integer:=0;
BEGIN
 FOR c IN SELECT * FROM public.plan_changes WHERE status='scheduled' AND effective_at<=now() ORDER BY effective_at, created_at FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   PERFORM public.apply_plan_edit(c.plan_id,c.new_values,c.created_by,c.keep_price);
   UPDATE public.plan_changes SET status='applied' WHERE id=c.id; n:=n+1;
  EXCEPTION WHEN OTHERS THEN
   RAISE WARNING 'Scheduled plan change % not applied: %', c.id, SQLERRM;
  END;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.apply_scheduled_plan_changes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_scheduled_plan_changes() TO service_role;