import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { formatGBP, formatDateUK } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { useCustomFieldColumns } from "@/components/CustomFieldDisplay";
import { CostBreakdown } from "@/components/CostBreakdown";
import { useBuiltinFieldLabel, useBuiltinFieldOptions } from "@/lib/builtin-labels";
import type { Database } from "@/integrations/supabase/types";

type SStatus = Database["public"]["Enums"]["subscription_status"];
type Sub = {
  id: string; plan_name: string; cost: number; billing_cycle: string;
  renewal_date: string | null; status: SStatus; client_org_id: string | null; client_contact_id: string | null;
  custom: Record<string, unknown> | null;
};
type Org = { id: string; name: string };
type Contact = { id: string; first_name: string; last_name: string; organisation_id: string | null };

export const Route = createFileRoute("/_authenticated/subscriptions")({ component: SubscriptionsPage });

function SubscriptionsPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("subscriptions");
  const [rows, setRows] = useState<Sub[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sub | null>(null);

  const load = async () => {
    const [{ data: s }, { data: o }, { data: c }] = await Promise.all([
      supabase.from("subscriptions").select("*").order("renewal_date", { ascending: true, nullsFirst: false }),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
    ]);
    setRows((s ?? []) as Sub[]); setOrgs((o ?? []) as Org[]); setContacts((c ?? []) as Contact[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (s: Sub) => {
    if (!confirm(`Delete subscription "${s.plan_name}"?`)) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "subscriptions", entity_type: "subscription", entity_id: s.id, verb: "deleted", summary: `Deleted subscription ${s.plan_name}` });
    toast.success("Deleted"); void load();
  };

  const saveCell = async (row: Sub, key: string, value: unknown) => {
    const { error } = await supabase.from("subscriptions").update({ [key]: value } as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const mrr = rows.filter((r) => r.status === "active").reduce((sum, r) => {
    const c = Number(r.cost);
    return sum + (r.billing_cycle === "yearly" ? c / 12 : r.billing_cycle === "quarterly" ? c / 3 : c);
  }, 0);

  const cycleLabel = useBuiltinFieldLabel("subscriptions", "billing_cycle");
  const subStatusLabel = useBuiltinFieldLabel("subscriptions", "status");
  const cycleOptions = useBuiltinFieldOptions("subscriptions", "billing_cycle");
  const subStatusOptions = useBuiltinFieldOptions("subscriptions", "status");

  const columns: DataTableColumn<Sub>[] = [
    { key: "plan_name", header: "Plan", accessor: (r) => r.plan_name, editable, type: "text" },
    { key: "client", header: "Client", accessor: (r) => orgs.find((o) => o.id === r.client_org_id)?.name ?? "" },
    {
      key: "billing_cycle", header: "Cycle", accessor: (r) => r.billing_cycle,
      render: (r) => <span>{cycleLabel(r.billing_cycle)}</span>,
      editable, type: "select",
      options: cycleOptions,
    },
    { key: "cost", header: "Final Costs", accessor: (r) => Number(r.cost), render: (r) => formatGBP(r.cost), editable, type: "number", align: "right" },
    { key: "renewal_date", header: "Renewal", accessor: (r) => r.renewal_date, render: (r) => formatDateUK(r.renewal_date), editable, type: "date" },
    {
      key: "status", header: "Status", accessor: (r) => r.status,
      render: (r) => <Badge variant={r.status === "active" ? "default" : r.status === "past_due" ? "destructive" : "secondary"}>{subStatusLabel(r.status)}</Badge>,
      editable, type: "select",
      options: subStatusOptions,
    },
  ];
  const customCols = useCustomFieldColumns<Sub>("subscriptions");
  const allColumns = [...columns, ...customCols];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Recurring client plans and renewals.</p>
        </div>
        {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New subscription</Button>}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Active</p><p className="text-2xl font-semibold mt-1">{rows.filter((r) => r.status === "active").length}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">MRR</p><p className="text-2xl font-semibold mt-1">{formatGBP(mrr)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Total plans</p><p className="text-2xl font-semibold mt-1">{rows.length}</p></CardContent></Card>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <DataTable
            tableKey="subscriptions"
            columns={allColumns}
            rows={rows}
            rowId={(r) => r.id}
            onSaveCell={saveCell}
            emptyMessage="No subscriptions yet."
            actions={editable ? (r) => (
              <>
                <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
              </>
            ) : undefined}
          />
        </CardContent>
      </Card>

      <SubDialog open={open} onOpenChange={setOpen} sub={editing} orgs={orgs} contacts={contacts} onSaved={load} />
    </div>
  );
}

function SubDialog({ open, onOpenChange, sub, orgs, contacts, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; sub: Sub | null; orgs: Org[]; contacts: Contact[]; onSaved: () => void;
}) {
  const [plan, setPlan] = useState(""); const [cost, setCost] = useState("0");
  const [cycle, setCycle] = useState("monthly");
  const [renewal, setRenewal] = useState(""); const [status, setStatus] = useState<SStatus>("active");
  const [org, setOrg] = useState<string>("__none__"); const [contact, setContact] = useState<string>("__none__");
  const [customVals, setCustomVals] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setPlan(sub?.plan_name ?? ""); setCost(String(sub?.cost ?? 0));
    setCycle(sub?.billing_cycle ?? "monthly"); setRenewal(sub?.renewal_date ?? "");
    setStatus(sub?.status ?? "active");
    setOrg(sub?.client_org_id ?? "__none__"); setContact(sub?.client_contact_id ?? "__none__");
    setCustomVals((sub?.custom ?? {}) as Record<string, unknown>);
  }, [sub, open]);

  const submit = async () => {
    if (!plan.trim()) return;
    const payload = {
      plan_name: plan, cost: Number(cost) || 0, billing_cycle: cycle,
      renewal_date: renewal || null, status,
      client_org_id: org === "__none__" ? null : org,
      client_contact_id: contact === "__none__" ? null : contact,
      custom: customVals as never,
    };
    if (sub) {
      const { error } = await supabase.from("subscriptions").update(payload).eq("id", sub.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "subscriptions", entity_type: "subscription", entity_id: sub.id, verb: "updated", summary: `Updated subscription ${plan}` });
    } else {
      const { data, error } = await supabase.from("subscriptions").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "subscriptions", entity_type: "subscription", entity_id: data.id, verb: "created", summary: `Created subscription ${plan}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  const filteredContacts = org === "__none__" ? contacts : contacts.filter((c) => c.organisation_id === org);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{sub ? "Edit subscription" : "New subscription"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Plan name *</Label><Input value={plan} onChange={(e) => setPlan(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Final Costs (£)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /><p className="text-xs text-muted-foreground">Use the breakdown below to auto-calculate this.</p></div>
            <div className="space-y-1">
              <Label>Billing cycle</Label>
              <Select value={cycle} onValueChange={setCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Renewal date</Label><Input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Client org</Label>
              <Select value={org} onValueChange={(v) => { setOrg(v); setContact("__none__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contact</Label>
              <Select value={contact} onValueChange={setContact}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {filteredContacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CustomFieldValues module="subscriptions" value={customVals} onChange={setCustomVals} />
          {sub && (
            <div className="space-y-2 pt-3 border-t">
              <h4 className="text-sm font-semibold">Final Costs breakdown</h4>
              <CostBreakdown
                parentType="subscription"
                parentId={sub.id}
                editable
                onTotalsChange={({ final }) => {
                  if (final > 0 && String(final) !== cost) setCost(String(final));
                }}
              />
            </div>
          )}
          {!sub && <p className="text-xs text-muted-foreground">Save the subscription to add an itemised breakdown.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!plan.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
