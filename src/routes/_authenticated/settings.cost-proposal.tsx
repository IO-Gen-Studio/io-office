import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Upload, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import defaultTemplate from "@/assets/cost-proposal-template.pdf.asset.json";

export const Route = createFileRoute("/_authenticated/settings/cost-proposal")({
  component: CostProposalSettings,
});

type Row = {
  tenant_id: string;
  template_path: string | null;
  conditions_project: string[];
  conditions_work: string[];
  conditions_subscription: string[];
};

function CostProposalSettings() {
  const { isAdmin, isSuperAdmin, activeTenantId } = useAuth();
  const canEdit = isAdmin || isSuperAdmin;
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cost_proposal_settings")
      .select("*")
      .maybeSingle();
    if (data) {
      setRow(data as Row);
    } else if (activeTenantId) {
      setRow({
        tenant_id: activeTenantId,
        template_path: null,
        conditions_project: [
          "This proposal is valid for 30 days.",
          "Invoices must be paid within 30 days.",
          "IO-Gen Ltd will keep all information from the client confidential",
        ],
        conditions_work: [
          "This proposal is valid for 30 days.",
          "Invoices must be paid within 30 days.",
          "IO-Gen Ltd will keep all information from the client confidential",
        ],
        conditions_subscription: [
          "This proposal is valid for 30 days.",
          "Invoices must be paid within 30 days.",
          "IO-Gen Ltd will keep all information from the client confidential",
        ],
      });
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [activeTenantId]);

  const save = async () => {
    if (!row || !activeTenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("cost_proposal_settings")
      .upsert({ ...row, tenant_id: activeTenantId } as never, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved");
    void load();
  };

  const uploadTemplate = async (file: File) => {
    if (!activeTenantId) return;
    setUploading(true);
    const path = `${activeTenantId}/cost-proposal-template/template-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("project-files").upload(path, file, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) { setUploading(false); toast.error(error.message); return; }
    // Remove old file if present
    if (row?.template_path) {
      await supabase.storage.from("project-files").remove([row.template_path]);
    }
    const { error: upErr } = await supabase
      .from("cost_proposal_settings")
      .upsert({
        tenant_id: activeTenantId,
        template_path: path,
        conditions_project: row?.conditions_project ?? [],
        conditions_work: row?.conditions_work ?? [],
        conditions_subscription: row?.conditions_subscription ?? [],
      } as never, { onConflict: "tenant_id" });
    setUploading(false);
    if (upErr) { toast.error(upErr.message); return; }
    toast.success("Template uploaded");
    void load();
  };

  const downloadCurrent = async () => {
    if (!row?.template_path) {
      window.open(defaultTemplate.url, "_blank");
      return;
    }
    const { data, error } = await supabase.storage.from("project-files").download(row.template_path);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    const url = URL.createObjectURL(data);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  if (!canEdit) return <p className="text-sm text-muted-foreground">Admins only.</p>;
  if (loading || !row) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-3">
          <div>
            <h3 className="font-semibold">Cost Proposal Template</h3>
            <p className="text-sm text-muted-foreground">
              PDF used as the background for every generated proposal. If not set, the built-in IO-Gen template is used.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
              <FileText className="size-4 text-muted-foreground" />
              <span>{row.template_path ? row.template_path.split("/").pop() : "Default (built-in)"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCurrent}>
              <Download className="size-4 mr-1" />View current
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="size-4 mr-1" />{uploading ? "Uploading…" : "Upload new template"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadTemplate(f);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      <ConditionsEditor
        title="Conditions — Projects"
        items={row.conditions_project}
        onChange={(v) => setRow({ ...row, conditions_project: v })}
      />
      <ConditionsEditor
        title="Conditions — Works"
        items={row.conditions_work}
        onChange={(v) => setRow({ ...row, conditions_work: v })}
      />
      <ConditionsEditor
        title="Conditions — Subscriptions"
        items={row.conditions_subscription}
        onChange={(v) => setRow({ ...row, conditions_subscription: v })}
      />

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function ConditionsEditor({
  title, items, onChange,
}: {
  title: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <Button size="sm" variant="outline" onClick={() => onChange([...items, ""])}>
            <Plus className="size-4 mr-1" />Add
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conditions.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <Label className="text-muted-foreground pt-2 w-6 text-right">{idx + 1}.</Label>
                <Input
                  value={it}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = e.target.value;
                    onChange(next);
                  }}
                />
                <Button variant="ghost" size="icon" aria-label="Delete item" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
