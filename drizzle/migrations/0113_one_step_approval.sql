
-- One-step approval: suggested + published listing name/headline per role,
-- new About Company fields, decision reasons, and per-user banner/pop-up state.

-- Buyers (profile keyed by user_id)
alter table public.buyer_profiles
  add column suggested_listing_name text,
  add column suggested_headline text,
  add column published_listing_name text,
  add column published_headline text,
  add column revenue_band text,
  add column contact_number text,
  add column decision_reasons text[] not null default '{}';

-- Seller listings: published listing name stays in code_name (Admin-only today);
-- published headline is new; suggestions are new.
alter table public.hidden_profiles
  add column suggested_listing_name text,
  add column suggested_headline text,
  add column published_headline text,
  add column review_checks text[] not null default '{}';

-- Seller company contact number (About Company / Exclusive view)
alter table public.startups
  add column contact_number text;

-- Advisors: card title falls back to name until Admin publishes a listing name
alter table public.advisor_firms
  add column suggested_listing_name text,
  add column suggested_headline text,
  add column published_listing_name text,
  add column published_headline text;

-- Buyer verification carries the same decision reasons as the profile
alter table public.investor_profile_verifications
  add column decision_reasons text[] not null default '{}',
  add column review_checks text[] not null default '{}';

-- Per-user state for the approval banners and the once-only approved pop-up.
-- One row per user per profile/listing; reset by each new Admin decision.
create table public.approval_notices (
  user_id uuid not null,
  item_type text not null,
  item_id uuid not null,
  decided_at timestamptz,
  popup_seen_at timestamptz,
  banner_step text,
  yellow_folded boolean not null default false,
  red_open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
grant select on public.approval_notices to authenticated;
grant all on public.approval_notices to service_role;
alter table public.approval_notices enable row level security;
create policy "Users read their own approval notices"
  on public.approval_notices for select to authenticated
  using (auth.uid() = user_id);
