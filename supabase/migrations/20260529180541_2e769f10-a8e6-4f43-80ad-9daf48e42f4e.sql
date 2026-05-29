ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS stages jsonb NOT NULL DEFAULT '{}'::jsonb;