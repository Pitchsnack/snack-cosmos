-- Add only the FKs that aren't already present
ALTER TABLE public.startups
  ADD CONSTRAINT startups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.startup_ownership
  ADD CONSTRAINT startup_ownership_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT startup_ownership_owning_agent_user_id_fkey FOREIGN KEY (owning_agent_user_id) REFERENCES public.users(id);

ALTER TABLE public.startup_ai_ownership
  ADD CONSTRAINT startup_ai_ownership_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT startup_ai_ownership_owning_ai_agent_id_fkey FOREIGN KEY (owning_ai_agent_id) REFERENCES public.users(id);

ALTER TABLE public.startup_users
  ADD CONSTRAINT startup_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.startup_activity
  ADD CONSTRAINT startup_activity_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT startup_activity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.investor_ownership
  ADD CONSTRAINT investor_ownership_owning_agent_user_id_fkey FOREIGN KEY (owning_agent_user_id) REFERENCES public.users(id);

ALTER TABLE public.investor_ai_ownership
  ADD CONSTRAINT investor_ai_ownership_owning_ai_agent_id_fkey FOREIGN KEY (owning_ai_agent_id) REFERENCES public.users(id);

ALTER TABLE public.investor_users
  ADD CONSTRAINT investor_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.investor_activity
  ADD CONSTRAINT investor_activity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.deals
  ADD CONSTRAINT deals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  ADD CONSTRAINT deals_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startups(id) ON DELETE RESTRICT,
  ADD CONSTRAINT deals_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE RESTRICT;

ALTER TABLE public.deal_ownership
  ADD CONSTRAINT deal_ownership_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD CONSTRAINT deal_ownership_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT deal_ownership_owning_agent_user_id_fkey FOREIGN KEY (owning_agent_user_id) REFERENCES public.users(id);

ALTER TABLE public.deal_ai_ownership
  ADD CONSTRAINT deal_ai_ownership_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD CONSTRAINT deal_ai_ownership_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT deal_ai_ownership_owning_ai_agent_id_fkey FOREIGN KEY (owning_ai_agent_id) REFERENCES public.users(id);

ALTER TABLE public.deal_activity
  ADD CONSTRAINT deal_activity_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD CONSTRAINT deal_activity_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT deal_activity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.deal_documents
  ADD CONSTRAINT deal_documents_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD CONSTRAINT deal_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  ADD CONSTRAINT deal_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.deal_tags
  ADD CONSTRAINT deal_tags_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD CONSTRAINT deal_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

NOTIFY pgrst, 'reload schema';