import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm")({ component: CrmPage });

type Org = { id: string; name: string; industry: string | null; website: string | null; notes: string | null };
type Contact = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; job_title: string | null; organisation_id: string | null; is_lead: boolean; notes: string | null };

function CrmPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("crm");
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">CRM</h1>
          <p className="text-muted-foreground mt-1">Contacts, leads and organisations.</p>
        </div>
      </div>
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="orgs">Organisations</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-4"><ContactsTab editable={editable} /></TabsContent>
        <TabsContent value="orgs" className="mt-4"><OrgsTab editable={editable} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OrgsTab({ editable }: { editable: boolean }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Org | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("organisations").select("*").order("name");
    setOrgs((data ?? []) as Org[]);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => orgs.filter((o) =>
    !q || o.name.toLowerCase().includes(q.toLowerCase()) || (o.industry ?? "").toLowerCase().includes(q.toLowerCase())
  ), [orgs, q]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete organisation "${name}"?`)) return;
    const { error } = await supabase.from("organisations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "crm", entity_type: "organisation", entity_id: id, verb: "deleted", summary: `Deleted organisation ${name}` });
    toast.success("Deleted"); void load();
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search organisations" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New organisation</Button>}
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Industry</TableHead><TableHead>Website</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No organisations yet.</TableCell></TableRow> :
              filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-muted-foreground">{o.industry || "—"}</TableCell>
                  <TableCell>{o.website ? <a href={o.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{o.website}</a> : "—"}</TableCell>
                  <TableCell className="text-right">
                    {editable && <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(o); setOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(o.id, o.name)}><Trash2 className="size-4" /></Button>
                    </>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <OrgDialog open={open} onOpenChange={setOpen} org={editing} onSaved={load} />
      </CardContent>
    </Card>
  );
}

function OrgDialog({ open, onOpenChange, org, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; org: Org | null; onSaved: () => void }) {
  const [name, setName] = useState(""); const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState(""); const [notes, setNotes] = useState("");
  useEffect(() => {
    setName(org?.name ?? ""); setIndustry(org?.industry ?? "");
    setWebsite(org?.website ?? ""); setNotes(org?.notes ?? "");
  }, [org, open]);

  const submit = async () => {
    if (!name.trim()) return;
    const payload = { name, industry: industry || null, website: website || null, notes: notes || null };
    if (org) {
      const { error } = await supabase.from("organisations").update(payload).eq("id", org.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "organisation", entity_id: org.id, verb: "updated", summary: `Updated organisation ${name}` });
    } else {
      const { data, error } = await supabase.from("organisations").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "organisation", entity_id: data.id, verb: "created", summary: `Created organisation ${name}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{org ? "Edit organisation" : "New organisation"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
            <div className="space-y-1"><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactsTab({ editable }: { editable: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "leads" | "clients">("all");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("organisations").select("id, name, industry, website, notes").order("name"),
    ]);
    setContacts((c ?? []) as Contact[]); setOrgs((o ?? []) as Org[]);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => contacts.filter((c) => {
    if (filter === "leads" && !c.is_lead) return false;
    if (filter === "clients" && c.is_lead) return false;
    if (q) {
      const s = q.toLowerCase();
      const orgName = orgs.find((o) => o.id === c.organisation_id)?.name ?? "";
      return [c.first_name, c.last_name, c.email, c.phone, orgName].some((v) => (v ?? "").toLowerCase().includes(s));
    }
    return true;
  }), [contacts, q, filter, orgs]);

  const remove = async (c: Contact) => {
    if (!confirm(`Delete contact "${c.first_name} ${c.last_name}"?`)) return;
    const { error } = await supabase.from("contacts").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "crm", entity_type: "contact", entity_id: c.id, verb: "deleted", summary: `Deleted contact ${c.first_name} ${c.last_name}` });
    toast.success("Deleted"); void load();
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "leads" | "clients")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="leads">Leads only</SelectItem>
              <SelectItem value="clients">Clients only</SelectItem>
            </SelectContent>
          </Select>
          {editable && <Button className="bg-gradient-primary text-primary-foreground ml-auto" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New contact</Button>}
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Organisation</TableHead>
            <TableHead>Job title</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No contacts.</TableCell></TableRow> :
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{orgs.find((o) => o.id === c.organisation_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.job_title || "—"}</TableCell>
                  <TableCell>{c.is_lead ? <Badge variant="secondary">Lead</Badge> : <Badge>Client</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {editable && <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="size-4" /></Button>
                    </>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <ContactDialog open={open} onOpenChange={setOpen} contact={editing} orgs={orgs} onSaved={load} />
      </CardContent>
    </Card>
  );
}

function ContactDialog({ open, onOpenChange, contact, orgs, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; contact: Contact | null; orgs: Org[]; onSaved: () => void;
}) {
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState(""); const [orgId, setOrgId] = useState<string>("__none__");
  const [isLead, setIsLead] = useState(true); const [notes, setNotes] = useState("");

  useEffect(() => {
    setFirst(contact?.first_name ?? ""); setLast(contact?.last_name ?? "");
    setEmail(contact?.email ?? ""); setPhone(contact?.phone ?? "");
    setJobTitle(contact?.job_title ?? ""); setOrgId(contact?.organisation_id ?? "__none__");
    setIsLead(contact?.is_lead ?? true); setNotes(contact?.notes ?? "");
  }, [contact, open]);

  const submit = async () => {
    if (!first.trim() && !last.trim()) return;
    const payload = {
      first_name: first, last_name: last, email: email || null, phone: phone || null,
      job_title: jobTitle || null, organisation_id: orgId === "__none__" ? null : orgId,
      is_lead: isLead, notes: notes || null,
    };
    if (contact) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", contact.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "contact", entity_id: contact.id, verb: "updated", summary: `Updated contact ${first} ${last}` });
    } else {
      const { data, error } = await supabase.from("contacts").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "contact", entity_id: data.id, verb: "created", summary: `Created ${isLead ? "lead" : "client"} ${first} ${last}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div className="space-y-1"><Label>Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label>Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Organisation</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={isLead ? "lead" : "client"} onValueChange={(v) => setIsLead(v === "lead")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
