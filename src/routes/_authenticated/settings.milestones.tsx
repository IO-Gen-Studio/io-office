import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/milestones")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: r } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: MilestonesSettings,
});

type Tpl = {
  id: string;
  label: string;
  position: number;
  module: string;
  project_type: string | null;
};

type Tab = "projects" | "subscriptions";

function MilestonesSettings() {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [tab, setTab] = useState<Tab>("projects");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<string>("both");

  const load = async () => {
    const { data, error } = await supabase
      .from("milestone_templates").select("*").order("module").order("position");
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Tpl[]);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => r.module === tab), [rows, tab]);

  const add = async () => {
    if (!newLabel.trim()) return;
    const pos = (filtered[filtered.length - 1]?.position ?? 0) + 1;
    const payload = {
      label: newLabel.trim(),
      position: pos,
      module: tab,
      project_type: tab === "projects" ? (newType === "both" ? null : newType) : null,
    } as never;
    const { error } = await supabase.from("milestone_templates").insert(payload);
    if (error) return toast.error(error.message);
    setNewLabel(""); setNewType("both");
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this milestone template? Existing items already created from it will not be affected.")) return;
    const { error } = await supabase.from("milestone_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const updateField = async (id: string, patch: Partial<Tpl>) => {
    const { error } = await supabase.from("milestone_templates").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const swap = async (a: Tpl, b: Tpl) => {
    const { error: e1 } = await supabase.from("milestone_templates").update({ position: b.position }).eq("id", a.id);
    const { error: e2 } = await supabase.from("milestone_templates").update({ position: a.position }).eq("id", b.id);
    if (e1 || e2) toast.error((e1 ?? e2)!.message);
    void load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Built-in milestones</h2>
        <p className="text-sm text-muted-foreground">
          Edit the default milestones that get added when a new project, work or subscription is created.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="projects">Projects &amp; Works</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default milestones</CardTitle>
              {tab === "projects" && (
                <p className="text-xs text-muted-foreground">
                  Mark a milestone as Project, Work or Both. The right set is applied when an item is created.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates yet.</p>
              ) : (
                filtered.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" aria-label="Move milestone up"
                        disabled={i === 0}
                        onClick={() => swap(t, filtered[i - 1])}>
                        <ArrowUp className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" aria-label="Move milestone down"
                        disabled={i === filtered.length - 1}
                        onClick={() => swap(t, filtered[i + 1])}>
                        <ArrowDown className="size-3" />
                      </Button>
                    </div>
                    <Input
                      defaultValue={t.label}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== t.label) void updateField(t.id, { label: v });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                    {tab === "projects" && (
                      <Select
                        value={t.project_type ?? "both"}
                        onValueChange={(v) => updateField(t.id, { project_type: v === "both" ? null : v })}
                      >
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Both</SelectItem>
                          <SelectItem value="project">Project only</SelectItem>
                          <SelectItem value="work">Work only</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(t.id)} title="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Add milestone</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Label</label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Kick-off call" />
                </div>
                {tab === "projects" && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Applies to</label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="project">Project only</SelectItem>
                        <SelectItem value="work">Work only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={add} disabled={!newLabel.trim()}>
                  <Plus className="size-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
