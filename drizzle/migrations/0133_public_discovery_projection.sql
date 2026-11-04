CREATE OR REPLACE FUNCTION public.discovery_public_rows()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
SELECT jsonb_build_object(
'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object(
'id',b.id,'ref',b.ref,'kind',b.kind,'status','posted','sector',b.sector,'name',b.name_on_card,'description',b.description,'location',b.location,'cities',COALESCE(b.cities,'Any'),'propertySize',b.property_size,'factorySize',b.factory_size,'products',b.products,'targetRevenue',b.target_revenue,'priceRange',b.price_range,'dealTypes',b.deal_types,'mustHave',b.must_have,'niceToHave',b.nice_to_have,'profit',b.profit,'timing',b.timing,'periodMonths',b.period_months,'nameTh',b.name_on_card_th,'descriptionTh',b.description_th,'productsTh',b.products_th,'mustHaveTh',COALESCE(b.must_have_th,'{}'::text[]),'niceToHaveTh',COALESCE(b.nice_to_have_th,'{}'::text[]),'timingTh',b.timing_th,'textLang',b.text_lang,'postedAt',b.posted_at,'closesOn',b.closes_on,'closedAt',NULL,'buyerType',COALESCE(i.investor_type,'Buyer'),'country',i.country,'aboutBuyer',NULL,'views',(SELECT count(*) FROM public.buy_order_views v WHERE v.buy_order_id=b.id),'applied',(SELECT count(*) FROM public.buy_order_applications a WHERE a.buy_order_id=b.id),'yours',false,'myApp',NULL,'appsTotal',NULL,'appsNew',NULL,'sentToAdminAt',NULL,'adminNote',NULL,'extendedCount',0,'client',NULL,'cover_image_path',b.cover_image_path,'cover_sector_image_id',b.cover_sector_image_id
) ORDER BY b.posted_at DESC) FROM public.buy_orders b LEFT JOIN public.investors i ON i.id=b.investor_profile_id WHERE b.status='posted' AND (b.closes_on IS NULL OR b.closes_on>(now() AT TIME ZONE 'Asia/Bangkok')::date)), '[]'::jsonb),
'listings', COALESCE((SELECT jsonb_agg(jsonb_build_object(
'id',h.id,'ref',h.ref_no,'publishedAt',h.published_at,'views',COALESCE(h.views,0),'ndas',(SELECT count(*) FROM public.deal_pipelines d WHERE d.hidden_profile_id=h.id AND d.nda_requested_at IS NOT NULL),'sector',s.sector,'location',NULLIF(split_part(COALESCE(s.city,''),',',1),''),'companyType',s.company_type,'decade',CASE WHEN s.year_founded IS NOT NULL THEN (s.year_founded/10)*10 END,'employees',s.company_size,'revenueBand',CASE WHEN s.last_year_revenue ~* '(below|under|over|–|-|\+|ต่ำกว่า)' THEN s.last_year_revenue END,'certified',s.registration_verified_at IS NOT NULL,'hasFinancials',EXISTS(SELECT 1 FROM public.financial_statements f WHERE f.startup_id=s.id),'publicImageId',h.public_image_id,'codeName',COALESCE(h.live->>'code_name',h.ref_no),'headline',h.live->>'headline','description',h.live->>'description','highlights',COALESCE(h.live->'highlights','[]'::jsonb),'productTags',COALESCE(h.live->'product_tags','[]'::jsonb),'marketTags',COALESCE(h.live->'market_tags','[]'::jsonb),'headlineTh',h.live->>'headline_th','descriptionTh',h.live->>'description_th','highlightsTh',COALESCE(h.live->'highlights_th','[]'::jsonb),'dealType',h.live->>'deal_type','reason',h.live->>'reason','reasonTh',h.live->>'reason_th','handover',h.live->>'handover','priceKey',public.asking_price_band(COALESCE(NULLIF(h.live->>'asking_price_thb','')::numeric,NULLIF(h.live->>'asking_price','')::numeric*1000000)::bigint)
) ORDER BY h.published_at DESC NULLS LAST) FROM public.hidden_profiles h JOIN public.startups s ON s.id=h.startup_id WHERE h.live IS NOT NULL AND h.approval_status IN ('live','live_edits_pending','in_review')), '[]'::jsonb));
$fn$;
REVOKE ALL ON FUNCTION public.discovery_public_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_public_rows() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.discovery_public_rows() IS 'Discovery allowlist: open buy orders and approved live listing snapshots, no buyer identity or private listing facts. No base-table anonymous grants.';
CREATE OR REPLACE FUNCTION public.discovery_record_view(_id uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
 IF _kind='sale' THEN
 UPDATE public.hidden_profiles SET views=COALESCE(views,0)+1 WHERE id=_id AND live IS NOT NULL AND approval_status IN ('live','live_edits_pending','in_review');
 ELSIF _kind='wanted' AND auth.uid() IS NOT NULL THEN
 IF EXISTS (SELECT 1 FROM public.buy_orders WHERE id=_id AND status='posted' AND (closes_on IS NULL OR closes_on>(now() AT TIME ZONE 'Asia/Bangkok')::date)) THEN
 INSERT INTO public.buy_order_views(buy_order_id,user_id) VALUES (_id,auth.uid()) ON CONFLICT DO NOTHING;
 END IF;
 END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.discovery_record_view(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_record_view(uuid,text) TO anon, authenticated, service_role;