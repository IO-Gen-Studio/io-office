
-- Add new approval status value
ALTER TYPE public.approval_status ADD VALUE IF NOT EXISTS 'for_approval';

-- Add approvers column to social_plans
ALTER TABLE public.social_plans
  ADD COLUMN IF NOT EXISTS approvers uuid[] NOT NULL DEFAULT '{}'::uuid[];
