
-- ===== 1. STATUS: remove 'Archived' =====
-- Re-stamp legacy archived rows: keep them archived via visibility, set status='Active'.
-- (Pre-flight: 0 rows currently have status='Archived', so this is a no-op today.)
UPDATE public.startups
SET visibility = 'Archived', status = 'Active'
WHERE status = 'Archived';

ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS startups_status_chk;
ALTER TABLE public.startups
  ADD CONSTRAINT startups_status_chk
  CHECK (status IN ('Draft','Active','Fundraising','Due Diligence','Portfolio','Exited'));

-- ===== 2. INDUSTRY: text -> text[] =====
ALTER TABLE public.startups ADD COLUMN industry_arr text[] NOT NULL DEFAULT '{}';
UPDATE public.startups
SET industry_arr = string_to_array(industry, ', ')
WHERE industry IS NOT NULL AND industry <> '';
ALTER TABLE public.startups DROP COLUMN industry;
ALTER TABLE public.startups RENAME COLUMN industry_arr TO industry;
CREATE INDEX IF NOT EXISTS startups_industry_gin
  ON public.startups USING gin (industry);

-- ===== 3. URL_KEY: normalized website domain =====
CREATE OR REPLACE FUNCTION public.normalize_url_key(_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    split_part(
      split_part(
        regexp_replace(
          regexp_replace(lower(coalesce(_url, '')), '^\s*https?://', ''),
          '^www\.', ''
        ),
        '/', 1
      ),
      '?', 1
    ),
    ''
  );
$$;

ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS url_key text;

CREATE OR REPLACE FUNCTION public.tg_startups_set_url_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.url_key := public.normalize_url_key(NEW.website_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS startups_set_url_key ON public.startups;
CREATE TRIGGER startups_set_url_key
  BEFORE INSERT OR UPDATE OF website_url ON public.startups
  FOR EACH ROW EXECUTE FUNCTION public.tg_startups_set_url_key();

-- Backfill existing rows (touches website_url path via direct call).
UPDATE public.startups
SET url_key = public.normalize_url_key(website_url);

-- NON-unique per-tenant index — duplicate detection is advisory, not blocking.
CREATE INDEX IF NOT EXISTS startups_tenant_url_key_idx
  ON public.startups (tenant_id, url_key)
  WHERE url_key IS NOT NULL;
