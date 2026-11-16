CREATE OR REPLACE FUNCTION public.is_active_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _uid
    AND u.status::text NOT IN ('Suspended','Locked','Archived','Deleted'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated, service_role;

ALTER POLICY "peer_set_members readable by authenticated" ON public.peer_set_members USING (public.is_active_member(auth.uid()));
ALTER POLICY "listed_companies readable by authenticated" ON public.listed_companies USING (public.is_active_member(auth.uid()));
ALTER POLICY "report_prices_read" ON public.report_prices USING (public.is_active_member(auth.uid()));
ALTER POLICY "prd2_roles_select_authenticated" ON public.roles USING (public.is_active_member(auth.uid()));
ALTER POLICY "peers readable by authenticated" ON public.peers USING (public.is_active_member(auth.uid()));
ALTER POLICY "peer_sets readable by authenticated" ON public.peer_sets USING (public.is_active_member(auth.uid()));
ALTER POLICY "Signed-in users read sector images" ON public.sector_images USING (public.is_active_member(auth.uid()));
ALTER POLICY "Signed-in users read investor images" ON public.investor_images USING (public.is_active_member(auth.uid()));
ALTER POLICY "Signed-in users read public images" ON storage.objects USING (bucket_id = 'public-images' AND public.is_active_member(auth.uid()));