import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/plans")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: r } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: PlansSettings,
});

type Opt = { id: string; label: string; position: number };

function PlansSettings() {
  const [rows, setRows] = useState<Opt[]>([]);
  const [newLabel, setNewLabel] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("subscription_plan_options").select("*").order("position");
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Opt[]);
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const position = (rows[rows.length - 1]?.position ?? -1) + 1;
    const { error } = await supabase.from("subscription_plan_options").insert({ label, position } as never);
    if (error) return toast.error(error.message);
    setNewLabel(""); void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this plan option? Existing subscriptions using this name will keep their label.")) return;
    const { error } = await supabase.from("subscription_plan_options").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const updateLabel = async (id: string, label: string) => {
    const { error } = await supabase.from("subscription_plan_options").update({ label } as never).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const swap = async (a: Opt, b: Opt) => {
    const { error: e1 } = await supabase.from("subscription_plan_options").update({ position: b.position }).eq("id", a.id);
    const { error: e2 } = await supabase.from("subscription_plan_options").update({ position: a.position }).eq("id", b.id);
    if (e1 || e2) toast.error((e1 ?? e2)!.message);
    void load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Subscription plans</h2>
        <p className="text-sm text-muted-foreground">Manage the list of plan names available when creating or editing a subscription.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Plan options</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : (
            rows.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" aria-label="Move plan up" disabled={i === 0} onClick={() => swap(t, rows[i - 1])}>
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" aria-label="Move plan down" disabled={i === rows.length - 1} onClick={() => swap(t, rows[i + 1])}>
                    <ArrowDown className="size-3" />
                  </Button>
                </div>
                <Input
                  defaultValue={t.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.label) void updateLabel(t.id, v);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                />
                <Button variant="ghost" size="icon" onClick={() => remove(t.id)} title="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Plan name</label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. IO-Gen Subscription (12-Months)" />
            </div>
            <Button onClick={add} disabled={!newLabel.trim()}><Plus className="size-4 mr-1" /> Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
