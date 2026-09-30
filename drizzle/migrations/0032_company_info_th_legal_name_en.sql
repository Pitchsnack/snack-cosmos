ALTER TABLE public.company_info_th
  ADD COLUMN IF NOT EXISTS legal_name_en text;

COMMENT ON COLUMN public.company_info_th.legal_name_en IS 'English registered name as published by DBD (ชื่อนิติบุคคลภาษาอังกฤษ).';