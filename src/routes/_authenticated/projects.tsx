import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { formatGBP, formatDateUK } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Plus, Pencil, Trash2, ArrowLeft, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PType = Database["public"]["Enums"]["project_type"];
type PStatus = Database["public"]["Enums"]["project_status"];
type Priority = Database["public"]["Enums"]["priority_level"];

type Project = {
  id: string; title: string; description: string | null; type: PType; status: PStatus; priority: Priority;
  team_lead_id: string | null; client_org_id: string | null; client_contact_id: string | null;
  start_date: string | null; end_date: string | null;
  total_cost: number; supplier_cost: number;
};
type Profile = { id: string; full_name: string };
type Org = { id: string; name: string };
type Contact = { id: string; first_name: string; last_name: string; organisation_id: string | null };
type Milestone = { id: string; project_id: string; label: string; due_date: string | null; completed_at: string | null; is_custom: boolean; position: number };
type MTemplate = { id: string; label: string; position: number };

export const Route = createFileRoute("/_authenticated/projects")({ component: ProjectsPage });

function ProjectsPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("projects");
  const [active, setActive] = useState<Project | null>(null);
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects &amp; Works</h1>
          <p className="text-muted-foreground mt-1">Track delivery, costs and milestones.</p>
        </div>
      </div>
      {active ? <ProjectDetail project={active} editable={editable} onBack={() => setActive(null)} onSaved={(p) => setActive(p)} /> : <ProjectList editable={editable} onOpen={setActive} />}
    </div>
  );
}

function ProjectList({ editable, onOpen }: { editable: boolean; onOpen: (p: Project) => void }) {
  const [rows, setRows] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<PType>("project");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: o }, { data: pr }, { data: c }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
    ]);
    setRows((p ?? []) as Project[]);
    setOrgs((o ?? []) as Org[]);
    setProfiles((pr ?? []) as Profile[]);
    setContacts((c ?? []) as Contact[]);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => r.type === tab), [rows, tab]);

  const remove = async (p: Project) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "projects", entity_type: p.type, entity_id: p.id, verb: "deleted", summary: `Deleted ${p.type} ${p.title}` });
    toast.success("Deleted"); void load();
  };

  const saveCell = async (row: Project, key: string, value: unknown) => {
    const { error } = await supabase.from("projects").update({ [key]: value } as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const columns: DataTableColumn<Project>[] = [
    { key: "title", header: "Title", accessor: (r) => r.title, editable, editField: "title", type: "text" },
    { key: "client", header: "Client", accessor: (r) => orgs.find((o) => o.id === r.client_org_id)?.name ?? "" },
    { key: "lead", header: "Lead", accessor: (r) => profiles.find((u) => u.id === r.team_lead_id)?.full_name ?? "" },
    {
      key: "status", header: "Status", accessor: (r) => r.status,
      render: (r) => <Badge variant="secondary" className="capitalize">{r.status.replace("_", " ")}</Badge>,
      editable, type: "select",
      options: [
        { value: "in_progress", label: "In progress" }, { value: "on_hold", label: "On hold" },
        { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
      ],
    },
    {
      key: "priority", header: "Priority", accessor: (r) => r.priority,
      render: (r) => <Badge variant={r.priority === "high" ? "destructive" : r.priority === "low" ? "outline" : "default"} className="capitalize">{r.priority}</Badge>,
      editable, type: "select",
      options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }],
    },
    { key: "end_date", header: "End date", accessor: (r) => r.end_date, render: (r) => formatDateUK(r.end_date), editable, type: "date", align: "right" },
    { key: "total_cost", header: "Total cost", accessor: (r) => Number(r.total_cost), render: (r) => formatGBP(r.total_cost), editable, type: "number", align: "right" },
  ];

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as PType)}>
      <div className="flex justify-between items-center">
        <TabsList>
          <TabsTrigger value="project">Projects</TabsTrigger>
          <TabsTrigger value="work">Works</TabsTrigger>
        </TabsList>
        {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />New {tab}</Button>}
      </div>
      <TabsContent value={tab} className="mt-4">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <DataTable
              tableKey={`projects.${tab}`}
              columns={columns}
              rows={filtered}
              rowId={(r) => r.id}
              onSaveCell={saveCell}
              onRowClick={onOpen}
              emptyMessage={`No ${tab}s yet.`}
              actions={(r) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title="Open" onClick={() => onOpen(r)}><FolderOpen className="size-4" /></Button>
                  {editable && <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>}
                </div>
              )}
            />
          </CardContent>
        </Card>
        <ProjectDialog open={open} onOpenChange={setOpen} project={null} defaultType={tab} orgs={orgs} contacts={contacts} profiles={profiles} onSaved={load} />
      </TabsContent>
    </Tabs>
  );
}

function ProjectDetail({ project, editable, onBack, onSaved }: { project: Project; editable: boolean; onBack: () => void; onSaved: (p: Project) => void }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const load = async () => {
    const [{ data: m }, { data: o }, { data: pr }, { data: c }, { data: fresh }] = await Promise.all([
      supabase.from("milestones").select("*").eq("project_id", project.id).order("position"),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
      supabase.from("projects").select("*").eq("id", project.id).single(),
    ]);
    setMilestones((m ?? []) as Milestone[]);
    setOrgs((o ?? []) as Org[]); setProfiles((pr ?? []) as Profile[]); setContacts((c ?? []) as Contact[]);
    if (fresh) onSaved(fresh as Project);
  };
  useEffect(() => { void load(); }, [project.id]);

  const toggleCompleted = async (m: Milestone, completed: boolean) => {
    const completed_at = completed ? new Date().toISOString() : null;
    const { error } = await supabase.from("milestones").update({ completed_at }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const updateDueDate = async (m: Milestone, due_date: string | null) => {
    const { error } = await supabase.from("milestones").update({ due_date }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const addCustom = async () => {
    if (!customLabel.trim()) return;
    const { error } = await supabase.from("milestones").insert({
      project_id: project.id, label: customLabel, is_custom: true,
      position: milestones.length,
    });
    if (error) { toast.error(error.message); return; }
    setCustomLabel(""); void load();
  };

  const removeMilestone = async (m: Milestone) => {
    const { error } = await supabase.from("milestones").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const profit = Number(project.total_cost) - Number(project.supplier_cost);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4 mr-1" />Back</Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{project.title}</h2>
          <p className="text-sm text-muted-foreground capitalize">{project.type} · {project.status.replace("_", " ")} · {project.priority} priority</p>
        </div>
        {editable && <Button variant="outline" onClick={() => setOpenEdit(true)}><Pencil className="size-4 mr-2" />Edit</Button>}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Total cost" value={formatGBP(project.total_cost)} />
        <StatCard label="Supplier cost" value={formatGBP(project.supplier_cost)} />
        <StatCard label="Profit" value={formatGBP(profit)} accent={profit >= 0 ? "text-primary" : "text-destructive"} />
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">Details</h3>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <Info label="Client" value={orgs.find((o) => o.id === project.client_org_id)?.name ?? "—"} />
            <Info label="Contact" value={(() => { const c = contacts.find((x) => x.id === project.client_contact_id); return c ? `${c.first_name} ${c.last_name}` : "—"; })()} />
            <Info label="Team lead" value={profiles.find((u) => u.id === project.team_lead_id)?.full_name ?? "—"} />
            <Info label="Dates" value={`${formatDateUK(project.start_date)} → ${formatDateUK(project.end_date)}`} />
          </div>
          {project.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Milestones</h3>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left p-2 w-10">Done</th>
                    <th className="text-left p-2">Milestone</th>
                    <th className="text-left p-2 w-44">Due date</th>
                    <th className="text-left p-2 w-32">Completed</th>
                    {editable && <th className="text-right p-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="p-2">
                        <Checkbox
                          checked={!!m.completed_at}
                          onCheckedChange={(c) => editable && toggleCompleted(m, c === true)}
                          disabled={!editable}
                        />
                      </td>
                      <td className={`p-2 ${m.completed_at ? "line-through text-muted-foreground" : ""}`}>{m.label}</td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={m.due_date ?? ""}
                          disabled={!editable}
                          onChange={(e) => updateDueDate(m, e.target.value || null)}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{formatDateUK(m.completed_at)}</td>
                      {editable && <td className="p-2 text-right">
                        {m.is_custom && <Button variant="ghost" size="icon" onClick={() => removeMilestone(m)}><Trash2 className="size-4" /></Button>}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editable && (
            <div className="flex gap-2 pt-2 border-t">
              <Input placeholder="Add custom milestone" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
              <Button onClick={addCustom} disabled={!customLabel.trim()}>Add</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectDialog open={openEdit} onOpenChange={setOpenEdit} project={project} defaultType={project.type} orgs={orgs} contacts={contacts} profiles={profiles} onSaved={load} />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></div>;
}

function ProjectDialog({ open, onOpenChange, project, defaultType, orgs, contacts, profiles, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; project: Project | null; defaultType: PType;
  orgs: Org[]; contacts: Contact[]; profiles: Profile[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [type, setType] = useState<PType>(defaultType);
  const [status, setStatus] = useState<PStatus>("in_progress");
  const [priority, setPriority] = useState<Priority>("medium");
  const [teamLead, setTeamLead] = useState<string>("__none__");
  const [clientOrg, setClientOrg] = useState<string>("__none__");
  const [clientContact, setClientContact] = useState<string>("__none__");
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [totalCost, setTotalCost] = useState("0"); const [supplierCost, setSupplierCost] = useState("0");

  useEffect(() => {
    setTitle(project?.title ?? ""); setDescription(project?.description ?? "");
    setType(project?.type ?? defaultType);
    setStatus(project?.status ?? "in_progress");
    setPriority(project?.priority ?? "medium");
    setTeamLead(project?.team_lead_id ?? "__none__");
    setClientOrg(project?.client_org_id ?? "__none__");
    setClientContact(project?.client_contact_id ?? "__none__");
    setStartDate(project?.start_date ?? ""); setEndDate(project?.end_date ?? "");
    setTotalCost(String(project?.total_cost ?? 0));
    setSupplierCost(String(project?.supplier_cost ?? 0));
  }, [project, open, defaultType]);

  const submit = async () => {
    if (!title.trim()) return;
    const payload = {
      title, description: description || null, type, status, priority,
      team_lead_id: teamLead === "__none__" ? null : teamLead,
      client_org_id: clientOrg === "__none__" ? null : clientOrg,
      client_contact_id: clientContact === "__none__" ? null : clientContact,
      start_date: startDate || null, end_date: endDate || null,
      total_cost: Number(totalCost) || 0,
      supplier_cost: Number(supplierCost) || 0,
    };
    if (project) {
      const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "projects", entity_type: type, entity_id: project.id, verb: "updated", summary: `Updated ${type} ${title}` });
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      const { data: tpls } = await supabase.from("milestone_templates").select("*").order("position");
      if (tpls && tpls.length > 0) {
        await supabase.from("milestones").insert(
          (tpls as MTemplate[]).map((t) => ({ project_id: data.id, label: t.label, position: t.position, is_custom: false }))
        );
      }
      await logActivity({ module: "projects", entity_type: type, entity_id: data.id, verb: "created", summary: `Created ${type} ${title}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  const filteredContacts = clientOrg === "__none__" ? contacts : contacts.filter((c) => c.organisation_id === clientOrg);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{project ? "Edit" : "New"} {type}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="project">Project</SelectItem><SelectItem value="work">Work</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Team lead</Label>
              <Select value={teamLead} onValueChange={setTeamLead}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Client org</Label>
              <Select value={clientOrg} onValueChange={(v) => { setClientOrg(v); setClientContact("__none__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Client contact</Label>
              <Select value={clientContact} onValueChange={setClientContact}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {filteredContacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Total cost (£)</Label><Input type="number" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} /></div>
            <div className="space-y-1"><Label>Supplier cost (£)</Label><Input type="number" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
