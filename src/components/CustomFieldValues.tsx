import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type CustomFieldModule = "crm" | "outreach" | "social" | "projects" | "subscriptions";

type FieldType =
  | "text" | "long_text" | "number" | "date"
  | "dropdown" | "checkbox" | "checklist" | "attachment" | "reference";

export type CustomFieldDef = {
  id: string;
  module: CustomFieldModule;
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
  position: number;
};

const refTableMap: Record<string, { table: string; labelExpr: (r: Record<string, unknown>) => string }> = {
  contacts: { table: "contacts", labelExpr: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(unnamed)" },
  organisations: { table: "organisations", labelExpr: (r) => String(r.name ?? "") },
  campaigns: { table: "campaigns", labelExpr: (r) => String(r.name ?? "") },
  projects: { table: "projects", labelExpr: (r) => String(r.title ?? "") },
  subscriptions: { table: "subscriptions", labelExpr: (r) => String(r.plan_name ?? "") },
  profiles: { table: "profiles", labelExpr: (r) => String(r.full_name ?? r.email ?? "") },
};

export function useCustomFieldDefs(module: CustomFieldModule) {
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("custom_field_defs").select("*").eq("module", module).order("position");
      if (!cancelled) setDefs((data ?? []) as CustomFieldDef[]);
    })();
    return () => { cancelled = true; };
  }, [module]);
  return defs;
}

export function CustomFieldValues({
  module, value, onChange,
}: {
  module: CustomFieldModule;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const defs = useCustomFieldDefs(module);
  if (defs.length === 0) return null;

  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-3 pt-2 border-t">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Other information</p>
      <div className="grid grid-cols-2 gap-3">
        {defs.map((d) => (
          <div key={d.id} className={d.type === "long_text" || d.type === "checklist" ? "col-span-2 space-y-1" : "space-y-1"}>
            <Label>{d.label}</Label>
            <FieldInput def={d} value={value?.[d.key]} onChange={(v) => set(d.key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldInput({ def, value, onChange }: { def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  switch (def.type) {
    case "text":
      return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "long_text":
      return <Textarea rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input type="number" value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "date":
      return <Input type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} />;
    case "checkbox":
      return (
        <div className="flex items-center h-9">
          <Checkbox checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
        </div>
      );
    case "dropdown": {
      const opts = (Array.isArray(def.options) ? def.options : []) as string[];
      return (
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case "checklist": {
      const opts = (Array.isArray(def.options) ? def.options : []) as string[];
      const set = new Set(Array.isArray(value) ? (value as string[]) : []);
      const toggle = (o: string) => {
        const next = new Set(set);
        if (next.has(o)) next.delete(o); else next.add(o);
        onChange(Array.from(next));
      };
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {opts.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={set.has(o)} onCheckedChange={() => toggle(o)} /> {o}
            </label>
          ))}
        </div>
      );
    }
    case "attachment":
      return <AttachmentInput value={value as string | null | undefined} onChange={onChange} />;
    case "reference":
      return <ReferenceInput target={(def.options as { target?: string })?.target ?? "contacts"} value={value as string | null | undefined} onChange={onChange} />;
  }
}

function AttachmentInput({ value, onChange }: { value: string | null | undefined; onChange: (v: unknown) => void }) {
  const [uploading, setUploading] = useState(false);
  const onUpload = async (file: File) => {
    setUploading(true);
    const path = `custom/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("project-files").upload(path, file);
    setUploading(false);
    if (error) return toast.error(error.message);
    onChange(path);
  };
  return (
    <div className="space-y-1">
      <Input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
      {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {value && <p className="text-xs text-muted-foreground truncate">Attached: {value}</p>}
    </div>
  );
}

function ReferenceInput({ target, value, onChange }: { target: string; value: string | null | undefined; onChange: (v: unknown) => void }) {
  const cfg = refTableMap[target];
  const [rows, setRows] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    if (!cfg) return;
    let cancelled = false;
    (async () => {
      const cols = target === "contacts" ? "id, first_name, last_name"
        : target === "profiles" ? "id, full_name, email"
        : target === "projects" ? "id, title"
        : target === "subscriptions" ? "id, plan_name"
        : "id, name";
      const { data } = await supabase.from(cfg.table as never).select(cols).limit(500);
      if (cancelled) return;
      const arr = (data ?? []) as Array<Record<string, unknown>>;
      setRows(arr.map((r) => ({ id: String(r.id), label: cfg.labelExpr(r) })));
    })();
    return () => { cancelled = true; };
  }, [target]);
  if (!cfg) return <Input value={String(value ?? "")} disabled />;
  return (
    <Select value={value ? String(value) : "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
