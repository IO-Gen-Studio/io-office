ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending_renewal';

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date date;