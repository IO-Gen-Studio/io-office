ALTER TABLE public.issue_column_defs
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.issue_column_defs
  ALTER COLUMN type TYPE public.custom_field_type
  USING type::text::public.custom_field_type;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS issues_tenant_owner_id_idx
  ON public.issues (tenant_id, owner_id);

UPDATE public.issues i
SET owner_id = p.id
FROM public.profiles p
WHERE i.owner_id IS NULL
  AND i.owner IS NOT NULL
  AND lower(trim(i.owner)) IN (lower(trim(p.full_name)), lower(trim(p.email)))
  AND public.is_tenant_member(p.id, i.tenant_id);

WITH tenant_ids AS (
  SELECT DISTINCT tenant_id FROM public.issues
  UNION
  SELECT DISTINCT tenant_id FROM public.issue_column_defs
), builtins(key, label, type, options, position) AS (
  VALUES
    ('issue_number', 'Task ID', 'number'::public.custom_field_type, '[]'::jsonb, 0),
    ('task', 'Task', 'long_text'::public.custom_field_type, '[]'::jsonb, 1),
    ('issue_date', 'Date', 'date'::public.custom_field_type, '[]'::jsonb, 2),
    ('priority', 'Priority', 'dropdown'::public.custom_field_type, '["H","M","L"]'::jsonb, 3),
    ('owner_id', 'Owner', 'reference'::public.custom_field_type, '{"target":"profiles"}'::jsonb, 4),
    ('status', 'Status', 'dropdown'::public.custom_field_type, '["Open","In Progress","Resolved","Closed"]'::jsonb, 5),
    ('comment', 'Comment', 'long_text'::public.custom_field_type, '[]'::jsonb, 6)
)
INSERT INTO public.issue_column_defs (tenant_id, key, label, type, options, position, is_builtin, is_active)
SELECT t.tenant_id, b.key, b.label, b.type, b.options, b.position, true, true
FROM tenant_ids t CROSS JOIN builtins b
ON CONFLICT (tenant_id, key) DO UPDATE
SET is_builtin = true,
    label = CASE WHEN issue_column_defs.key = 'issue_number' THEN 'Task ID' ELSE issue_column_defs.label END;

UPDATE public.issue_column_defs
SET position = position + 7
WHERE is_builtin = false
  AND position < 7;