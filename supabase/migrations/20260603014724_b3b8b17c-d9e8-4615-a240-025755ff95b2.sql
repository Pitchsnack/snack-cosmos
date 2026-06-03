
-- PRD 7: Deal Sharing Engine
CREATE TABLE public.deal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL,
  shared_by_user_id UUID,
  shared_by_role VARCHAR(100),
  share_reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Shared',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_shares_deal ON public.deal_shares(deal_id);
CREATE INDEX idx_deal_shares_tenant ON public.deal_shares(tenant_id);

CREATE TABLE public.deal_share_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_share_id UUID NOT NULL REFERENCES public.deal_shares(id) ON DELETE CASCADE,
  target_tenant_id UUID NOT NULL,
  target_user_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_share_targets_share ON public.deal_share_targets(deal_share_id);
CREATE INDEX idx_deal_share_targets_target_tenant ON public.deal_share_targets(target_tenant_id);

CREATE TABLE public.deal_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL,
  startup_id UUID,
  investor_id UUID,
  introduced_by_user_id UUID,
  introduced_to_user_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'Requested',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_introductions_deal ON public.deal_introductions(deal_id);

CREATE TABLE public.deal_share_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_share_id UUID NOT NULL REFERENCES public.deal_shares(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL,
  activity_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_share_activity_share ON public.deal_share_activity(deal_share_id);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_shares TO authenticated;
GRANT ALL ON public.deal_shares TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_share_targets TO authenticated;
GRANT ALL ON public.deal_share_targets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_introductions TO authenticated;
GRANT ALL ON public.deal_introductions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_share_activity TO authenticated;
GRANT ALL ON public.deal_share_activity TO service_role;

-- updated_at triggers
CREATE TRIGGER trg_deal_shares_updated BEFORE UPDATE ON public.deal_shares
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_deal_share_targets_updated BEFORE UPDATE ON public.deal_share_targets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_deal_introductions_updated BEFORE UPDATE ON public.deal_introductions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.can_access_shared_deal(_user_id uuid, _deal_share_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_control(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.deal_shares ds
      WHERE ds.id = _deal_share_id
        AND (
          public.user_in_tenant(_user_id, ds.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.deal_share_targets dst
            WHERE dst.deal_share_id = ds.id
              AND public.user_in_tenant(_user_id, dst.target_tenant_id)
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_shared_deal(_user_id uuid, _deal_share_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_control(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.deal_shares ds
      WHERE ds.id = _deal_share_id
        AND (
          public.is_tenant_admin_of(_user_id, ds.tenant_id)
          OR public.is_master_agent_of(_user_id, ds.tenant_id)
          OR ds.shared_by_user_id = _user_id
        )
    );
$$;

-- Enable RLS
ALTER TABLE public.deal_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_share_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_share_activity ENABLE ROW LEVEL SECURITY;

-- Policies: deal_shares
CREATE POLICY prd7_ds_select ON public.deal_shares FOR SELECT TO authenticated
  USING (public.can_access_shared_deal(auth.uid(), id));
CREATE POLICY prd7_ds_insert ON public.deal_shares FOR INSERT TO authenticated
  WITH CHECK (
    public.is_control(auth.uid())
    OR public.is_master_agent_of(auth.uid(), tenant_id)
    OR (public.user_in_tenant(auth.uid(), tenant_id) AND shared_by_user_id = auth.uid())
  );
CREATE POLICY prd7_ds_update ON public.deal_shares FOR UPDATE TO authenticated
  USING (public.can_manage_shared_deal(auth.uid(), id))
  WITH CHECK (public.can_manage_shared_deal(auth.uid(), id));
CREATE POLICY prd7_ds_delete ON public.deal_shares FOR DELETE TO authenticated
  USING (public.can_manage_shared_deal(auth.uid(), id));

-- Policies: deal_share_targets
CREATE POLICY prd7_dst_select ON public.deal_share_targets FOR SELECT TO authenticated
  USING (
    public.is_control(auth.uid())
    OR public.user_in_tenant(auth.uid(), target_tenant_id)
    OR public.can_access_shared_deal(auth.uid(), deal_share_id)
  );
CREATE POLICY prd7_dst_insert ON public.deal_share_targets FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shared_deal(auth.uid(), deal_share_id));
CREATE POLICY prd7_dst_update ON public.deal_share_targets FOR UPDATE TO authenticated
  USING (
    public.can_manage_shared_deal(auth.uid(), deal_share_id)
    OR public.user_in_tenant(auth.uid(), target_tenant_id)
  )
  WITH CHECK (
    public.can_manage_shared_deal(auth.uid(), deal_share_id)
    OR public.user_in_tenant(auth.uid(), target_tenant_id)
  );
CREATE POLICY prd7_dst_delete ON public.deal_share_targets FOR DELETE TO authenticated
  USING (public.can_manage_shared_deal(auth.uid(), deal_share_id));

-- Policies: deal_introductions
CREATE POLICY prd7_di_select ON public.deal_introductions FOR SELECT TO authenticated
  USING (
    public.is_control(auth.uid())
    OR public.can_access_deal(auth.uid(), deal_id)
  );
CREATE POLICY prd7_di_insert ON public.deal_introductions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_deal(auth.uid(), deal_id));
CREATE POLICY prd7_di_update ON public.deal_introductions FOR UPDATE TO authenticated
  USING (
    public.is_control(auth.uid())
    OR public.can_manage_deal(auth.uid(), tenant_id)
    OR introduced_by_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_control(auth.uid())
    OR public.can_manage_deal(auth.uid(), tenant_id)
    OR introduced_by_user_id = auth.uid()
  );

-- Policies: deal_share_activity
CREATE POLICY prd7_dsa_select ON public.deal_share_activity FOR SELECT TO authenticated
  USING (public.can_access_shared_deal(auth.uid(), deal_share_id));
CREATE POLICY prd7_dsa_insert ON public.deal_share_activity FOR INSERT TO authenticated
  WITH CHECK (public.can_access_shared_deal(auth.uid(), deal_share_id));
