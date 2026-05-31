import { useCustomFieldDefs, type CustomFieldDef, type CustomFieldModule } from "@/components/CustomFieldValues";
import type { DataTableColumn } from "@/components/DataTable";

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

/** Returns DataTable columns derived from custom field defs for the given module. */
export function useCustomFieldColumns<T extends { custom: Record<string, unknown> | null }>(
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
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Custom fields</p>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {defs.map((d) => {
          const formatted = formatValue(d, vals[d.key]);
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
