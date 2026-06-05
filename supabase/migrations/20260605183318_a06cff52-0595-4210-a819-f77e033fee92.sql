
DO $$ BEGIN
  ALTER TABLE public.deal_shares ADD CONSTRAINT deal_shares_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_shares ADD CONSTRAINT deal_shares_shared_by_user_id_fkey FOREIGN KEY (shared_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_shares ADD CONSTRAINT deal_shares_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_share_targets ADD CONSTRAINT deal_share_targets_target_tenant_id_fkey FOREIGN KEY (target_tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
NOTIFY pgrst, 'reload schema';
