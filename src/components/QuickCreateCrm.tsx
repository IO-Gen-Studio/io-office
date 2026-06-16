import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type QuickOrg = { id: string; name: string };
export type QuickContact = {
  id: string;
  first_name: string;
  last_name: string;
  organisation_id: string | null;
};

export function QuickCreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (org: QuickOrg) => void;
}) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setIndustry("");
      setWebsite("");
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("organisations")
      .insert({ name, industry: industry || null, website: website || null } as never)
      .select("id, name")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create organisation");
      return;
    }
    await logActivity({
      module: "crm",
      entity_type: "organisation",
      entity_id: data.id,
      verb: "created",
      summary: `Created organisation ${data.name}`,
    });
    toast.success("Organisation created");
    onCreated({ id: data.id, name: data.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organisation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="bg-gradient-primary text-primary-foreground"
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuickCreateContactDialog({
  open,
  onOpenChange,
  orgs,
  defaultOrgId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgs: QuickOrg[];
  defaultOrgId?: string | null;
  onCreated: (contact: QuickContact) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [orgId, setOrgId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFirst("");
      setLast("");
      setEmail("");
      setJobTitle("");
      setOrgId(defaultOrgId && defaultOrgId !== "__none__" ? defaultOrgId : "__none__");
    }
  }, [open, defaultOrgId]);

  const submit = async () => {
    if (!first.trim() && !last.trim()) return;
    if (saving) return;
    setSaving(true);
    const orgValue = orgId === "__none__" ? null : orgId;
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        first_name: first,
        last_name: last,
        email: email || null,
        job_title: jobTitle || null,
        organisation_id: orgValue,
        is_lead: false,
      } as never)
      .select("id, first_name, last_name, organisation_id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create contact");
      return;
    }
    await logActivity({
      module: "crm",
      entity_type: "contact",
      entity_id: data.id,
      verb: "created",
      summary: `Created contact ${data.first_name} ${data.last_name}`,
    });
    toast.success("Contact created");
    onCreated({
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      organisation_id: data.organisation_id,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Job title</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Organisation</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={(!first.trim() && !last.trim()) || saving}
            className="bg-gradient-primary text-primary-foreground"
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
