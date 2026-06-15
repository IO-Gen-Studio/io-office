import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  FieldDialog,
  type FieldDef,
  type ModuleKey,
  TYPE_LABELS,
  REFERENCE_TARGETS,
} from "@/components/CustomFieldDialog";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { BUILTIN_DROPDOWNS, useBuiltinLabels, type BuiltinModule } from "@/lib/builtin-labels";

export const Route = createFileRoute("/_authenticated/settings/fields")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: FieldsPage,
});

const MODULES: { key: ModuleKey; label: string; builtIn: { label: string; type: string }[] }[] = [
  {
    key: "crm",
    label: "CRM",
    builtIn: [
      { label: "First name", type: "Short text" },
      { label: "Last name", type: "Short text" },
      { label: "Email", type: "Short text" },
      { label: "Phone", type: "Short text" },
      { label: "Job title", type: "Short text" },
      { label: "Organisation", type: "Reference" },
      { label: "Industry", type: "Short text" },
      { label: "Website", type: "Short text" },
      { label: "Notes", type: "Long text" },
    ],
  },
  {
    key: "outreach",
    label: "Email Outreach",
    builtIn: [
      { label: "First name", type: "Short text" },
      { label: "Last name", type: "Short text" },
      { label: "Email", type: "Short text" },
      { label: "Job title", type: "Short text" },
      { label: "Organisation", type: "Short text" },
      { label: "Industry", type: "Short text" },
      { label: "Website", type: "Short text" },
      { label: "Lead status", type: "Dropdown" },
      { label: "Notes", type: "Long text" },
    ],
  },
  {
    key: "social",
    label: "Social Planner",
    builtIn: [
      { label: "Title", type: "Short text" },
      { label: "Platform", type: "Dropdown" },
      { label: "Copy", type: "Long text" },
      { label: "Media", type: "Attachment" },
      { label: "Scheduled at", type: "Date" },
      { label: "Approval status", type: "Dropdown" },
      { label: "Post status", type: "Dropdown" },
    ],
  },
  {
    key: "projects",
    label: "Projects & Works",
    builtIn: [
      { label: "Title", type: "Short text" },
      { label: "Description", type: "Long text" },
      { label: "Type", type: "Dropdown" },
      { label: "Status", type: "Dropdown" },
      { label: "Priority", type: "Dropdown" },
      { label: "Start date", type: "Date" },
      { label: "End date", type: "Date" },
      { label: "Total cost", type: "Number" },
      { label: "Business cost", type: "Number" },
      { label: "Investment", type: "Number" },
      { label: "Client organisation", type: "Reference" },
      { label: "Client contact", type: "Reference" },
      { label: "Team lead", type: "Reference" },
    ],
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    builtIn: [
      { label: "Plan name", type: "Short text" },
      { label: "Cost", type: "Number" },
      { label: "Billing cycle", type: "Dropdown" },
      { label: "Renewal date", type: "Date" },
      { label: "Status", type: "Dropdown" },
      { label: "Client organisation", type: "Reference" },
      { label: "Client contact", type: "Reference" },
    ],
  },
  {
    key: "issues",
    label: "Issues Tracker",
    builtIn: [
      { label: "Number", type: "Number" },
      { label: "Task", type: "Short text" },
      { label: "Date", type: "Date" },
      { label: "Priority", type: "Dropdown" },
      { label: "Owner", type: "Short text" },
      { label: "Status", type: "Dropdown" },
      { label: "Comment", type: "Long text" },
    ],
  },
];

function FieldsPage() {
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleKey>("crm");
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [{ data, error }, { data: issueData, error: issueError }] = await Promise.all([
      supabase.from("custom_field_defs").select("*").order("module").order("position"),
      supabase.from("issue_column_defs").select("*").order("position"),
    ]);
    if (error || issueError)
      toast.error(error?.message ?? issueError?.message ?? "Unable to load fields");
    setDefs([
      ...((data ?? []) as FieldDef[]),
      ...((issueData ?? []).map((field) => ({
        ...field,
        module: "issues" as const,
      })) as FieldDef[]),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const byModule = useMemo(() => {
    const m: Record<string, FieldDef[]> = {};
    for (const d of defs) if (d.module) (m[d.module] ??= []).push(d);
    return m;
  }, [defs]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this field? This cannot be undone.")) return;
    const field = defs.find((item) => item.id === id);
    const table = field?.module === "issues" ? "issue_column_defs" : "custom_field_defs";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Field deleted");
    void reload();
  };

  const moveIssueField = async (field: FieldDef, direction: -1 | 1) => {
    const list = byModule.issues ?? [];
    const index = list.findIndex((item) => item.id === field.id);
    const other = list[index + direction];
    if (index < 0 || !other) return;
    const [{ error: firstError }, { error: secondError }] = await Promise.all([
      supabase.from("issue_column_defs").update({ position: other.position }).eq("id", field.id),
      supabase.from("issue_column_defs").update({ position: field.position }).eq("id", other.id),
    ]);
    if (firstError || secondError)
      return toast.error(firstError?.message ?? secondError?.message ?? "Unable to reorder fields");
    void reload();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Other Information</h2>
        <p className="text-sm text-muted-foreground">
          Add, edit, or remove custom fields per module. Built-in fields are shown for reference.
        </p>
      </div>

      <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as ModuleKey)}>
        <TabsList className="flex flex-wrap h-auto">
          {MODULES.map((m) => (
            <TabsTrigger key={m.key} value={m.key}>
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {MODULES.map((m) => (
          <TabsContent key={m.key} value={m.key} className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Other information</CardTitle>
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Add field
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (byModule[m.key]?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom fields yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Key</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(byModule[m.key] ?? []).map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.label}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {f.key}
                          </TableCell>
                          <TableCell>{TYPE_LABELS[f.type]}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {f.type === "dropdown" || f.type === "checklist"
                              ? Array.isArray(f.options)
                                ? (f.options as string[]).join(", ")
                                : ""
                              : f.type === "reference"
                                ? `→ ${REFERENCE_TARGETS.find((t) => t.value === (f.options as { target?: string })?.target)?.label ?? "—"}`
                                : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {m.key === "issues" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Move ${f.label} up`}
                                  disabled={f === byModule.issues?.[0]}
                                  onClick={() => void moveIssueField(f, -1)}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Move ${f.label} down`}
                                  disabled={
                                    f === byModule.issues?.[(byModule.issues?.length ?? 1) - 1]
                                  }
                                  onClick={() => void moveIssueField(f, 1)}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Edit field"
                              onClick={() => setEditing(f)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Delete field"
                              onClick={() => onDelete(f.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {m.key !== "issues" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Built-in fields</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Rename dropdown options. The underlying value is preserved; only the label users
                    see changes.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {BUILTIN_DROPDOWNS.filter((s) => s.module === m.key).map((spec) => (
                    <BuiltinDropdownEditor
                      key={`${spec.module}.${spec.key}`}
                      module={spec.module}
                      fieldKey={spec.key}
                      fieldLabel={spec.label}
                    />
                  ))}
                  {m.builtIn.filter((b) => b.type !== "Dropdown").length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                        Other built-in fields
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="w-32" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.builtIn
                            .filter((b) => b.type !== "Dropdown")
                            .map((b) => (
                              <TableRow key={b.label}>
                                <TableCell className="font-medium">{b.label}</TableCell>
                                <TableCell>{b.type}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary">Built-in</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {(creating || editing) && (
        <FieldDialog
          module={activeModule}
          existing={editing}
          existingKeys={
            new Set(
              (byModule[activeModule] ?? []).filter((f) => f.id !== editing?.id).map((f) => f.key),
            )
          }
          nextPosition={byModule[activeModule]?.length ?? 0}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function BuiltinDropdownEditor({
  module,
  fieldKey,
  fieldLabel,
}: {
  module: BuiltinModule;
  fieldKey: string;
  fieldLabel: string;
}) {
  const spec = BUILTIN_DROPDOWNS.find((s) => s.module === module && s.key === fieldKey);
  const { overrides, reload } = useBuiltinLabels();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  if (!spec) return null;

  const labelFor = (value: string) =>
    drafts[value] ??
    overrides[`${module}.${fieldKey}.${value}`] ??
    spec.options.find((o) => o.value === value)?.defaultLabel ??
    value;

  const save = async (value: string) => {
    const next = (drafts[value] ?? "").trim();
    if (!next) return toast.error("Label cannot be empty");
    setSaving(value);
    const { error } = await supabase
      .from("builtin_field_labels")
      .upsert(
        { module, field_key: fieldKey, value, label: next },
        { onConflict: "module,field_key,value" },
      );
    setSaving(null);
    if (error) return toast.error(error.message);
    setDrafts((d) => {
      const { [value]: _, ...rest } = d;
      return rest;
    });
    await reload();
    toast.success("Label updated");
  };

  const reset = async (value: string) => {
    setSaving(value);
    const { error } = await supabase
      .from("builtin_field_labels")
      .delete()
      .eq("module", module)
      .eq("field_key", fieldKey)
      .eq("value", value);
    setSaving(null);
    if (error) return toast.error(error.message);
    setDrafts((d) => {
      const { [value]: _, ...rest } = d;
      return rest;
    });
    await reload();
    toast.success("Reset to default");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{fieldLabel}</p>
        <Badge variant="outline" className="text-xs">
          Dropdown
        </Badge>
      </div>
      <div className="space-y-1.5">
        {spec.options.map((o) => {
          const current = labelFor(o.value);
          const hasOverride = overrides[`${module}.${fieldKey}.${o.value}`] !== undefined;
          const dirty =
            drafts[o.value] !== undefined &&
            drafts[o.value] !== (overrides[`${module}.${fieldKey}.${o.value}`] ?? o.defaultLabel);
          return (
            <div key={o.value} className="flex items-center gap-2">
              <code
                className="text-xs text-muted-foreground font-mono w-32 truncate"
                title={o.value}
              >
                {o.value}
              </code>
              <Input
                value={current}
                onChange={(e) => setDrafts((d) => ({ ...d, [o.value]: e.target.value }))}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="default"
                disabled={!dirty || saving === o.value}
                onClick={() => save(o.value)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasOverride || saving === o.value}
                onClick={() => reset(o.value)}
              >
                Reset
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
