import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type FieldType = "text" | "long_text" | "number" | "date" | "dropdown" | "checkbox" | "checklist" | "attachment" | "reference";
export type ModuleKey = "crm" | "outreach" | "social" | "projects" | "subscriptions" | "issues";

export type FieldDef = {
  id: string;
  module: ModuleKey;
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
  position: number;
};

export const TYPE_LABELS: Record<FieldType, string> = {
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

export const REFERENCE_TARGETS = [
  { value: "contacts", label: "CRM Contact" },
  { value: "organisations", label: "Organisation" },
  { value: "campaigns", label: "Outreach Campaign" },
  { value: "projects", label: "Project / Work" },
  { value: "subscriptions", label: "Subscription" },
  { value: "profiles", label: "Team member" },
];

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
}

export function FieldDialog({
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
            Configure the custom field properties.
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
