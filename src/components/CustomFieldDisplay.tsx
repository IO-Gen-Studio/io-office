import { useCustomFieldDefs, type CustomFieldDef, type CustomFieldModule, AttachmentPreview, ReferencePreview, refTableMap } from "@/components/CustomFieldValues";
import type { DataTableColumn } from "@/components/DataTable";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function formatValue(def: CustomFieldDef, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (def.type) {
    case "checkbox": return v === true ? "Yes" : "No";
    case "checklist": return Array.isArray(v) ? (v as string[]).join(", ") : "";
    case "attachment": return String(v).split("/").pop() ?? String(v);
    case "date": return String(v);
    default: return String(v);
  }
}

/** Cell for a reference custom field in a table — resolves UUID -> label. */
function ReferenceCell({ def, value }: { def: CustomFieldDef; value: string }) {
  const target = (def.options as { target?: string })?.target ?? "contacts";
  const cfg = refTableMap[target];
  const [label, setLabel] = useState<string>("");
  useEffect(() => {
    if (!cfg || !value) { setLabel(""); return; }
    let cancelled = false;
    (async () => {
      const cols = target === "contacts" ? "id, first_name, last_name"
        : target === "profiles" ? "id, full_name, email"
        : target === "projects" ? "id, title"
        : target === "subscriptions" ? "id, plan_name"
        : "id, name";
      const { data } = await supabase.from(cfg.table as never).select(cols).eq("id", value).maybeSingle();
      if (!cancelled) setLabel(data ? cfg.labelExpr(data as Record<string, unknown>) : "");
    })();
    return () => { cancelled = true; };
  }, [target, value]);
  return <>{label || "…"}</>;
}

/** Returns DataTable columns derived from custom field defs for the given module. */
export function useCustomFieldColumns<T extends { custom?: Record<string, unknown> | null }>(
  module: CustomFieldModule,
): DataTableColumn<T>[] {
  const defs = useCustomFieldDefs(module);
  return defs.map((d) => ({
    key: `custom.${d.key}`,
    header: d.label,
    accessor: (r: T) => {
      const v = (r.custom ?? {})[d.key];
      return formatValue(d, v);
    },
    render: d.type === "reference"
      ? (r: T) => {
          const v = (r.custom ?? {})[d.key];
          return v ? <ReferenceCell def={d} value={String(v)} /> : <span className="text-muted-foreground">—</span>;
        }
      : undefined,
    sortable: true,
    filterable: true,
  }));
}

/** Read-only inline display of all custom field values for an entity. */
export function CustomFieldDisplay({
  module, value,
}: { module: CustomFieldModule; value: Record<string, unknown> | null | undefined }) {
  const defs = useCustomFieldDefs(module);
  if (defs.length === 0) return null;
  const vals = value ?? {};
  return (
    <div className="space-y-2 pt-3 border-t">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Other information</p>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {defs.map((d) => {
          const raw = vals[d.key];
          const hasValue = raw !== null && raw !== undefined && raw !== "";
          if (d.type === "attachment") {
            return (
              <div key={d.id} className="md:col-span-2 space-y-1">
                <span className="text-muted-foreground">{d.label}</span>
                {hasValue ? <AttachmentPreview path={String(raw)} /> : <p className="font-medium">—</p>}
              </div>
            );
          }
          if (d.type === "reference") {
            const target = (d.options as { target?: string })?.target ?? "contacts";
            return (
              <div key={d.id}>
                <span className="text-muted-foreground">{d.label}:</span>{" "}
                <span className="font-medium">
                  {hasValue ? <ReferencePreview target={target} value={String(raw)} /> : "—"}
                </span>
              </div>
            );
          }
          const formatted = formatValue(d, raw);
          return (
            <div key={d.id}>
              <span className="text-muted-foreground">{d.label}:</span>{" "}
              <span className="font-medium">{formatted || "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
