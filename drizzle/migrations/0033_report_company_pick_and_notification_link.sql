ALTER TABLE public.workspace_preferences ADD COLUMN IF NOT EXISTS last_report_company_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link_url text;