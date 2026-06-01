import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { BUILTIN_DROPDOWNS, useBuiltinLabels, type BuiltinModule } from "@/lib/builtin-labels";

export const Route = createFileRoute("/_authenticated/settings/fields")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role","admin").maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: FieldsPage,
});

type FieldType = "text" | "long_text" | "number" | "date" | "dropdown" | "checkbox" | "checklist" | "attachment" | "reference";
type ModuleKey = "crm" | "outreach" | "social" | "projects" | "subscriptions";

type FieldDef = {
  id: string;
  module: ModuleKey;
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
  position: number;
};

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  checklist: "Checklist",
  attachment: "Attachment",
  reference: "Reference",
};

const REFERENCE_TARGETS = [
  { value: "contacts", label: "CRM Contact" },
  { value: "organisations", label: "Organisation" },
  { value: "campaigns", label: "Outreach Campaign" },
  { value: "projects", label: "Project / Work" },
  { value: "subscriptions", label: "Subscription" },
  { value: "profiles", label: "Team member" },
];

const MODULES: { key: ModuleKey; label: string; builtIn: { label: string; type: string }[] }[] = [
  {
    key: "crm", label: "CRM",
    builtIn: [
      { label: "First name", type: "Short text" }, { label: "Last name", type: "Short text" },
      { label: "Email", type: "Short text" }, { label: "Phone", type: "Short text" },
      { label: "Job title", type: "Short text" }, { label: "Organisation", type: "Reference" },
      { label: "Industry", type: "Short text" }, { label: "Website", type: "Short text" },
      { label: "Notes", type: "Long text" },
    ],
  },
  {
    key: "outreach", label: "Email Outreach",
    builtIn: [
      { label: "First name", type: "Short text" }, { label: "Last name", type: "Short text" },
      { label: "Email", type: "Short text" }, { label: "Job title", type: "Short text" },
      { label: "Organisation", type: "Short text" }, { label: "Industry", type: "Short text" },
      { label: "Website", type: "Short text" }, { label: "Lead status", type: "Dropdown" },
      { label: "Notes", type: "Long text" },
    ],
  },
  {
    key: "social", label: "Social Planner",
    builtIn: [
      { label: "Title", type: "Short text" }, { label: "Platform", type: "Dropdown" },
      { label: "Copy", type: "Long text" }, { label: "Media", type: "Attachment" },
      { label: "Scheduled at", type: "Date" }, { label: "Approval status", type: "Dropdown" },
      { label: "Post status", type: "Dropdown" },
    ],
  },
  {
    key: "projects", label: "Projects & Works",
    builtIn: [
      { label: "Title", type: "Short text" }, { label: "Description", type: "Long text" },
      { label: "Type", type: "Dropdown" }, { label: "Status", type: "Dropdown" },
      { label: "Priority", type: "Dropdown" }, { label: "Start date", type: "Date" },
      { label: "End date", type: "Date" }, { label: "Total cost", type: "Number" },
      { label: "Business cost", type: "Number" }, { label: "Investment", type: "Number" },
      { label: "Client organisation", type: "Reference" }, { label: "Client contact", type: "Reference" },
      { label: "Team lead", type: "Reference" },
    ],
  },
  {
    key: "subscriptions", label: "Subscriptions",
    builtIn: [
      { label: "Plan name", type: "Short text" }, { label: "Cost", type: "Number" },
      { label: "Billing cycle", type: "Dropdown" }, { label: "Renewal date", type: "Date" },
      { label: "Status", type: "Dropdown" },
      { label: "Client organisation", type: "Reference" }, { label: "Client contact", type: "Reference" },
    ],
  },
];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
}

function FieldsPage() {
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleKey>("crm");
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_field_defs").select("*").order("module").order("position");
    if (error) toast.error(error.message);
    setDefs((data ?? []) as FieldDef[]);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const byModule = useMemo(() => {
    const m: Record<string, FieldDef[]> = {};
    for (const d of defs) (m[d.module] ??= []).push(d);
    return m;
  }, [defs]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this field? This cannot be undone.")) return;
    const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Field deleted");
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
            <TabsTrigger key={m.key} value={m.key}>{m.label}</TabsTrigger>
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
                          <TableCell className="font-mono text-xs text-muted-foreground">{f.key}</TableCell>
                          <TableCell>{TYPE_LABELS[f.type]}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {f.type === "dropdown" || f.type === "checklist"
                              ? (Array.isArray(f.options) ? (f.options as string[]).join(", ") : "")
                              : f.type === "reference"
                                ? `→ ${REFERENCE_TARGETS.find((t) => t.value === (f.options as { target?: string })?.target)?.label ?? "—"}`
                                : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => setEditing(f)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => onDelete(f.id)}>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Built-in fields</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Rename dropdown options. The underlying value is preserved; only the label users see changes.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {BUILTIN_DROPDOWNS.filter((s) => s.module === m.key).map((spec) => (
                  <BuiltinDropdownEditor key={`${spec.module}.${spec.key}`} module={spec.module} fieldKey={spec.key} fieldLabel={spec.label} />
                ))}
                {m.builtIn.filter((b) => b.type !== "Dropdown").length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Other built-in fields</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="w-32" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.builtIn.filter((b) => b.type !== "Dropdown").map((b) => (
                          <TableRow key={b.label}>
                            <TableCell className="font-medium">{b.label}</TableCell>
                            <TableCell>{b.type}</TableCell>
                            <TableCell className="text-right"><Badge variant="secondary">Built-in</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {(creating || editing) && (
        <FieldDialog
          module={activeModule}
          existing={editing}
          existingKeys={new Set((byModule[activeModule] ?? []).filter((f) => f.id !== editing?.id).map((f) => f.key))}
          nextPosition={(byModule[activeModule]?.length ?? 0)}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void reload(); }}
        />
      )}
    </div>
  );
}

function FieldDialog({
  module, existing, existingKeys, nextPosition, onClose, onSaved,
}: {
  module: ModuleKey;
  existing: FieldDef | null;
  existingKeys: Set<string>;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [key, setKey] = useState(existing?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(!!existing);
  const [type, setType] = useState<FieldType>(existing?.type ?? "text");
  const [optionsText, setOptionsText] = useState(
    existing && (existing.type === "dropdown" || existing.type === "checklist") && Array.isArray(existing.options)
      ? (existing.options as string[]).join("\n") : ""
  );
  const [refTarget, setRefTarget] = useState<string>(
    existing?.type === "reference" ? ((existing.options as { target?: string })?.target ?? "contacts") : "contacts"
  );
  const [saving, setSaving] = useState(false);

  const effectiveKey = keyTouched ? key : slugify(label);

  const save = async () => {
    const finalLabel = label.trim();
    const finalKey = slugify(effectiveKey);
    if (!finalLabel) return toast.error("Label is required");
    if (!finalKey) return toast.error("Key is required");
    if (existingKeys.has(finalKey)) return toast.error("Key must be unique within this module");

    let options: unknown = [];
    if (type === "dropdown" || type === "checklist") {
      options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      if ((options as string[]).length === 0) return toast.error("Add at least one option");
    } else if (type === "reference") {
      options = { target: refTarget };
    }

    setSaving(true);
    if (existing) {
      const { error } = await supabase.from("custom_field_defs").update({
        label: finalLabel, key: finalKey, type, options: options as never,
      }).eq("id", existing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Field updated");
    } else {
      const { error } = await supabase.from("custom_field_defs").insert({
        module, label: finalLabel, key: finalKey, type, options: options as never, position: nextPosition,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Field added");
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit field" : "Add field"}</DialogTitle>
          <DialogDescription>
            {MODULES.find((m) => m.key === module)?.label}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. LinkedIn URL" />
          </div>
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input
              value={effectiveKey}
              onChange={(e) => { setKeyTouched(true); setKey(e.target.value); }}
              placeholder="auto from label"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Lowercase identifier used internally.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(type === "dropdown" || type === "checklist") && (
            <div className="space-y-1.5">
              <Label>Options (one per line)</Label>
              <Textarea rows={5} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
            </div>
          )}
          {type === "reference" && (
            <div className="space-y-1.5">
              <Label>References</Label>
              <Select value={refTarget} onValueChange={setRefTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REFERENCE_TARGETS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Link to existing records from another part of the app.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuiltinDropdownEditor({
  module, fieldKey, fieldLabel,
}: { module: BuiltinModule; fieldKey: string; fieldLabel: string }) {
  const spec = BUILTIN_DROPDOWNS.find((s) => s.module === module && s.key === fieldKey);
  const { overrides, reload } = useBuiltinLabels();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  if (!spec) return null;

  const labelFor = (value: string) =>
    drafts[value] ?? overrides[`${module}.${fieldKey}.${value}`] ?? spec.options.find((o) => o.value === value)?.defaultLabel ?? value;

  const save = async (value: string) => {
    const next = (drafts[value] ?? "").trim();
    if (!next) return toast.error("Label cannot be empty");
    setSaving(value);
    const { error } = await supabase.from("builtin_field_labels").upsert(
      { module, field_key: fieldKey, value, label: next },
      { onConflict: "module,field_key,value" },
    );
    setSaving(null);
    if (error) return toast.error(error.message);
    setDrafts((d) => { const { [value]: _, ...rest } = d; return rest; });
    await reload();
    toast.success("Label updated");
  };

  const reset = async (value: string) => {
    setSaving(value);
    const { error } = await supabase.from("builtin_field_labels")
      .delete().eq("module", module).eq("field_key", fieldKey).eq("value", value);
    setSaving(null);
    if (error) return toast.error(error.message);
    setDrafts((d) => { const { [value]: _, ...rest } = d; return rest; });
    await reload();
    toast.success("Reset to default");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{fieldLabel}</p>
        <Badge variant="outline" className="text-xs">Dropdown</Badge>
      </div>
      <div className="space-y-1.5">
        {spec.options.map((o) => {
          const current = labelFor(o.value);
          const hasOverride = overrides[`${module}.${fieldKey}.${o.value}`] !== undefined;
          const dirty = drafts[o.value] !== undefined && drafts[o.value] !== (overrides[`${module}.${fieldKey}.${o.value}`] ?? o.defaultLabel);
          return (
            <div key={o.value} className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground font-mono w-32 truncate" title={o.value}>{o.value}</code>
              <Input
                value={current}
                onChange={(e) => setDrafts((d) => ({ ...d, [o.value]: e.target.value }))}
                className="flex-1"
              />
              <Button size="sm" variant="default" disabled={!dirty || saving === o.value} onClick={() => save(o.value)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" disabled={!hasOverride || saving === o.value} onClick={() => reset(o.value)}>
                Reset
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
