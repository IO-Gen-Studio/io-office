import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BuiltinModule = "crm" | "outreach" | "social" | "projects" | "subscriptions";

export type BuiltinFieldSpec = {
  module: BuiltinModule;
  key: string;
  label: string;
  options: { value: string; defaultLabel: string }[];
};

/** All built-in dropdown fields whose option labels can be renamed in Settings. */
export const BUILTIN_DROPDOWNS: BuiltinFieldSpec[] = [
  {
    module: "projects", key: "type", label: "Type",
    options: [
      { value: "project", defaultLabel: "Project" },
      { value: "work", defaultLabel: "Work" },
    ],
  },
  {
    module: "projects", key: "status", label: "Status",
    options: [
      { value: "in_progress", defaultLabel: "In progress" },
      { value: "on_hold", defaultLabel: "On hold" },
      { value: "completed", defaultLabel: "Completed" },
      { value: "cancelled", defaultLabel: "Cancelled" },
    ],
  },
  {
    module: "projects", key: "priority", label: "Priority",
    options: [
      { value: "low", defaultLabel: "Low" },
      { value: "medium", defaultLabel: "Medium" },
      { value: "high", defaultLabel: "High" },
    ],
  },
  {
    module: "social", key: "platform", label: "Platform",
    options: [
      { value: "linkedin", defaultLabel: "LinkedIn" },
      { value: "instagram", defaultLabel: "Instagram" },
      { value: "x", defaultLabel: "X" },
      { value: "threads", defaultLabel: "Threads" },
      { value: "facebook", defaultLabel: "Facebook" },
      { value: "tiktok", defaultLabel: "TikTok" },
      { value: "youtube", defaultLabel: "YouTube" },
      { value: "eventbrite", defaultLabel: "Eventbrite" },
    ],
  },
  {
    module: "social", key: "approval_status", label: "Approval status",
    options: [
      { value: "not_approved", defaultLabel: "Not approved" },
      { value: "approved", defaultLabel: "Approved" },
    ],
  },
  {
    module: "social", key: "post_status", label: "Post status",
    options: [
      { value: "not_posted", defaultLabel: "Not posted" },
      { value: "posted", defaultLabel: "Posted" },
      { value: "cancelled", defaultLabel: "Cancelled" },
    ],
  },
  {
    module: "subscriptions", key: "billing_cycle", label: "Billing cycle",
    options: [
      { value: "monthly", defaultLabel: "Monthly" },
      { value: "quarterly", defaultLabel: "Quarterly" },
      { value: "yearly", defaultLabel: "Yearly" },
    ],
  },
  {
    module: "subscriptions", key: "status", label: "Status",
    options: [
      { value: "active", defaultLabel: "Active" },
      { value: "paused", defaultLabel: "Paused" },
      { value: "past_due", defaultLabel: "Past due" },
      { value: "pending_renewal", defaultLabel: "Pending renewal" },
      { value: "cancelled", defaultLabel: "Cancelled" },
    ],
  },
];

type OverrideMap = Record<string, string>; // `${module}.${key}.${value}` -> label
type Ctx = { overrides: OverrideMap; reload: () => Promise<void> };

const BuiltinLabelsCtx = createContext<Ctx>({ overrides: {}, reload: async () => {} });

export function BuiltinLabelsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<OverrideMap>({});

  const reload = async () => {
    const { data } = await supabase.from("builtin_field_labels").select("module,field_key,value,label");
    const map: OverrideMap = {};
    for (const r of (data ?? []) as Array<{ module: string; field_key: string; value: string; label: string }>) {
      map[`${r.module}.${r.field_key}.${r.value}`] = r.label;
    }
    setOverrides(map);
  };

  useEffect(() => { void reload(); }, []);

  return <BuiltinLabelsCtx.Provider value={{ overrides, reload }}>{children}</BuiltinLabelsCtx.Provider>;
}

export function useBuiltinLabels() {
  return useContext(BuiltinLabelsCtx);
}

/** Returns a (value)=>label function for a given module/field, with override + default fallback. */
export function useBuiltinFieldLabel(module: BuiltinModule, fieldKey: string) {
  const { overrides } = useBuiltinLabels();
  const spec = useMemo(
    () => BUILTIN_DROPDOWNS.find((s) => s.module === module && s.key === fieldKey),
    [module, fieldKey],
  );
  return (value: string | null | undefined): string => {
    if (!value) return "";
    const override = overrides[`${module}.${fieldKey}.${value}`];
    if (override) return override;
    const def = spec?.options.find((o) => o.value === value)?.defaultLabel;
    return def ?? value.replace(/_/g, " ");
  };
}

/** Returns the full list of {value,label} for a field, applying overrides. */
export function useBuiltinFieldOptions(module: BuiltinModule, fieldKey: string) {
  const { overrides } = useBuiltinLabels();
  const spec = BUILTIN_DROPDOWNS.find((s) => s.module === module && s.key === fieldKey);
  if (!spec) return [] as { value: string; label: string }[];
  return spec.options.map((o) => ({
    value: o.value,
    label: overrides[`${module}.${fieldKey}.${o.value}`] ?? o.defaultLabel,
  }));
}
