UPDATE public.investors
SET
  year_founded = COALESCE(year_founded, 2024),
  wizard = jsonb_set(
    wizard,
    '{from_signup}',
    COALESCE((
      SELECT jsonb_agg(marker)
      FROM (
        SELECT DISTINCT marker
        FROM jsonb_array_elements_text(COALESCE(wizard->'from_signup', '[]'::jsonb)) AS existing(marker)
        UNION SELECT 'type'::text
        UNION SELECT 'year'::text
      ) AS markers
    ), '[]'::jsonb),
    false
  )
WHERE id = '209c16ed-6af1-443c-a37d-f3820f95a184'
  AND registration_no = '0735567002746'
  AND wizard->>'admin_profile' = 'true'
  AND COALESCE(wizard->'bp'->>'buyer_relation', '') = 'corporate';