INSERT INTO public.report_shares (business_id, buyer_id, pipeline_id, financials, valuation, allow_download, shared_at)
SELECT p.startup_id, p.buyer_user_id, p.id, true, true, COALESCE(p.report_allow_download, false), p.report_shared_at
FROM public.deal_pipelines p
WHERE p.report_shared_at IS NOT NULL AND p.startup_id IS NOT NULL AND p.buyer_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.report_shares s WHERE s.business_id = p.startup_id AND s.buyer_id = p.buyer_user_id AND s.revoked_at IS NULL)
ON CONFLICT DO NOTHING;