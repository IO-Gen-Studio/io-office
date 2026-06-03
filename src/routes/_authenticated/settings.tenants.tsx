import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListTenants, adminCreateTenant, adminUpdateTenant, adminDeleteTenant,
  adminAssignTenantMember, adminRemoveTenantMember, adminSetSuperAdmin, adminListUsers,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Users as UsersIcon, Trash2, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/tenants")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: s } = await supabase.from("super_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!s) throw redirect({ to: "/dashboard" });
  },
  component: TenantsPage,
});

type Tenant = { id: string; name: string; slug: string; active: boolean; logo_url: string | null };
type Profile = { id: string; email: string; full_name: string };
type Member = { tenant_id: string; user_id: string; role: string };

function TenantsPage() {
  const listFn = useServerFn(adminListTenants);
  const usersFn = useServerFn(adminListUsers);
  const { refresh: refreshAuth } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [supers, setSupers] = useState<string[]>([]);
  const [manageTenant, setManageTenant] = useState<Tenant | null>(null);

  const reload = async () => {
    const [t, u] = await Promise.all([listFn(), usersFn({} as never)]);
    setTenants((t as { tenants: Tenant[] }).tenants);
    setUsers((u as { profiles: Profile[] }).profiles);
    setMembers((u as { members: Member[] }).members);
    setSupers((u as { supers: { user_id: string }[] }).supers.map((s) => s.user_id));
    // Refresh auth context so the header tenant switcher picks up new orgs/members
    await refreshAuth();
  };
  useEffect(() => { void reload(); }, []);

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organisations</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Manage tenant organisations and their members.</p>
          </div>
          <CreateTenantButton onCreated={reload} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Members</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {tenants.map((t) => {
                const count = members.filter((m) => m.tenant_id === t.id).length;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{t.slug}</TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell>{t.active ? <Badge variant="outline">Active</Badge> : <Badge variant="destructive">Disabled</Badge>}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setManageTenant(t)}><UsersIcon className="size-4 mr-1" />Members</Button>
                      <EditTenantButton tenant={t} onSaved={reload} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Super admins</CardTitle></CardHeader>
        <CardContent>
          <SuperAdminManager users={users} supers={supers} onChanged={reload} />
        </CardContent>
      </Card>

      {manageTenant && (
        <ManageMembersDialog
          tenant={manageTenant}
          users={users}
          members={members.filter((m) => m.tenant_id === manageTenant.id)}
          onClose={() => setManageTenant(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function CreateTenantButton({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(adminCreateTenant);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const submit = async () => {
    try {
      await createFn({ data: { name, slug } });
      toast.success("Organisation created");
      setOpen(false); setName(""); setSlug("");
      onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-2" />New organisation</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create organisation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")); }} /></div>
          <div className="space-y-1"><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!name || !slug}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTenantButton({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const updateFn = useServerFn(adminUpdateTenant);
  const deleteFn = useServerFn(adminDeleteTenant);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [active, setActive] = useState(tenant.active);
  const save = async () => {
    try { await updateFn({ data: { id: tenant.id, name, active } }); toast.success("Saved"); setOpen(false); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const del = async () => {
    if (!confirm(`Delete "${tenant.name}" and ALL its data? This cannot be undone.`)) return;
    try { await deleteFn({ data: { id: tenant.id } }); toast.success("Deleted"); setOpen(false); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {tenant.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="text-sm font-medium">Active</div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter className="justify-between">
          <Button variant="destructive" size="sm" onClick={del}><Trash2 className="size-4 mr-1" />Delete</Button>
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageMembersDialog({ tenant, users, members, onClose, onChanged }: {
  tenant: Tenant; users: Profile[]; members: Member[]; onClose: () => void; onChanged: () => void;
}) {
  const assignFn = useServerFn(adminAssignTenantMember);
  const removeFn = useServerFn(adminRemoveTenantMember);
  const [pickUser, setPickUser] = useState<string>("");
  const [pickRole, setPickRole] = useState<"owner"|"member">("member");
  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = users.filter((u) => !memberIds.has(u.id));
  const add = async () => {
    if (!pickUser) return;
    try { await assignFn({ data: { tenant_id: tenant.id, user_id: pickUser, role: pickRole } }); toast.success("Added"); setPickUser(""); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const remove = async (uid: string) => {
    try { await removeFn({ data: { tenant_id: tenant.id, user_id: uid } }); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tenant.name} — Members</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Add user</Label>
              <Select value={pickUser} onValueChange={setPickUser}>
                <SelectTrigger><SelectValue placeholder="Select user…" /></SelectTrigger>
                <SelectContent>{candidates.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-1">
              <Label>Role</Label>
              <Select value={pickRole} onValueChange={(v) => setPickRole(v as "owner"|"member")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="owner">Owner</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={add} disabled={!pickUser}>Add</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {members.map((m) => {
                const u = users.find((x) => x.id === m.user_id);
                return (
                  <TableRow key={m.user_id}>
                    <TableCell>{u?.full_name || u?.email || m.user_id}</TableCell>
                    <TableCell><Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remove(m.user_id)}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SuperAdminManager({ users, supers, onChanged }: { users: Profile[]; supers: string[]; onChanged: () => void }) {
  const setFn = useServerFn(adminSetSuperAdmin);
  const toggle = async (uid: string, on: boolean) => {
    try { await setFn({ data: { user_id: uid, is_super: on } }); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <div className="space-y-2">
      {users.map((u) => {
        const isSuper = supers.includes(u.id);
        return (
          <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Shield className={`size-4 ${isSuper ? "text-primary" : "text-muted-foreground"}`} />
              <div><div className="text-sm font-medium">{u.full_name || u.email}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
            </div>
            <Switch checked={isSuper} onCheckedChange={(v) => toggle(u.id, v)} />
          </div>
        );
      })}
    </div>
  );
}
