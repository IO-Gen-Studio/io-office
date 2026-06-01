-- Resync subscriptions.cost from current cost_versions
UPDATE public.subscriptions s
SET cost = sub.total
FROM (
  SELECT cv.parent_id, COALESCE(SUM(ci.final_cost),0) AS total
  FROM public.cost_versions cv
  LEFT JOIN public.cost_items ci ON ci.version_id = cv.id
  WHERE cv.parent_type = 'subscription' AND cv.is_current
  GROUP BY cv.parent_id
) sub
WHERE s.id = sub.parent_id AND s.cost <> sub.total;

-- Resync projects.total_cost / supplier_cost from current cost_versions
UPDATE public.projects p
SET total_cost = sub.total_final, supplier_cost = sub.total_supplier
FROM (
  SELECT cv.parent_id,
         COALESCE(SUM(ci.final_cost),0) AS total_final,
         COALESCE(SUM(ci.supplier_cost),0) AS total_supplier
  FROM public.cost_versions cv
  LEFT JOIN public.cost_items ci ON ci.version_id = cv.id
  WHERE cv.parent_type = 'project' AND cv.is_current
  GROUP BY cv.parent_id
) sub
WHERE p.id = sub.parent_id
  AND (p.total_cost <> sub.total_final OR p.supplier_cost <> sub.total_supplier);