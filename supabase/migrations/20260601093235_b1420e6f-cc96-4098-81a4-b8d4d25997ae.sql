-- Remove duplicates by keeping the row with the smallest ctid per (parent_type, parent_id, label) for built-in milestones
DELETE FROM public.milestones a
USING public.milestones b
WHERE a.parent_type = b.parent_type
  AND a.parent_id = b.parent_id
  AND a.label = b.label
  AND a.is_custom = false
  AND b.is_custom = false
  AND a.ctid > b.ctid
  AND a.completed_at IS NULL;

-- For any pair that still remains because both have completed_at set, keep the earliest
DELETE FROM public.milestones a
USING public.milestones b
WHERE a.parent_type = b.parent_type
  AND a.parent_id = b.parent_id
  AND a.label = b.label
  AND a.is_custom = false
  AND b.is_custom = false
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS milestones_parent_builtin_label_uidx
  ON public.milestones (parent_type, parent_id, label)
  WHERE is_custom = false;