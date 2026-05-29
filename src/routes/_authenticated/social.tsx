import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Platform = Database["public"]["Enums"]["social_platform"];
type PostStatus = Database["public"]["Enums"]["post_status"];
type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

const PLATFORMS: Platform[] = ["linkedin", "instagram", "x", "threads", "facebook", "tiktok", "youtube"];

type Plan = {
  id: string; platform: Platform; copy: string; media_path: string | null;
  scheduled_at: string | null; post_status: PostStatus; approval_status: ApprovalStatus;
};

export const Route = createFileRoute("/_authenticated/social")({ component: SocialPage });

function SocialPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("social");
  const [rows, setRows] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const load = async () => {
    const { data } = await supabase.from("social_plans").select("*").order("scheduled_at", { ascending: true, nullsFirst: false });
    setRows((data ?? []) as Plan[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (p: Plan) => {
    if (!confirm("Delete post plan?")) return;
    const { error } = await supabase.from("social_plans").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "social", entity_type: "post", entity_id: p.id, verb: "deleted", summary: `Deleted ${p.platform} post` });
    toast.success("Deleted"); void load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Social Planner</h1>
          <p className="text-muted-foreground mt-1">Plan, approve and track posts across platforms.</p>
        </div>
        {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New post</Button>}
      </div>
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Platform</TableHead><TableHead>Copy</TableHead><TableHead>Scheduled</TableHead>
              <TableHead>Approval</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No posts planned.</TableCell></TableRow> :
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="secondary" className="capitalize">{p.platform}</Badge></TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">{p.copy || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "—"}</TableCell>
                    <TableCell>{p.approval_status === "approved" ? <Badge>Approved</Badge> : <Badge variant="outline">Not approved</Badge>}</TableCell>
                    <TableCell><Badge variant={p.post_status === "posted" ? "default" : p.post_status === "cancelled" ? "destructive" : "secondary"} className="capitalize">{p.post_status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">
                      {editable && <>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="size-4" /></Button>
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} onSaved={load} />
    </div>
  );
}

function PlanDialog({ open, onOpenChange, plan, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; plan: Plan | null; onSaved: () => void }) {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [copy, setCopy] = useState(""); const [scheduledAt, setScheduledAt] = useState("");
  const [approval, setApproval] = useState<ApprovalStatus>("not_approved");
  const [status, setStatus] = useState<PostStatus>("not_posted");
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPlatform(plan?.platform ?? "linkedin");
    setCopy(plan?.copy ?? "");
    setScheduledAt(plan?.scheduled_at ? new Date(plan.scheduled_at).toISOString().slice(0, 16) : "");
    setApproval(plan?.approval_status ?? "not_approved");
    setStatus(plan?.post_status ?? "not_posted");
    setMediaPath(plan?.media_path ?? null);
  }, [plan, open]);

  const onUpload = async (file: File) => {
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("social-media").upload(path, file);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setMediaPath(path);
    toast.success("Uploaded");
  };

  const submit = async () => {
    const payload = {
      platform, copy, media_path: mediaPath,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      approval_status: approval, post_status: status,
    };
    if (plan) {
      const { error } = await supabase.from("social_plans").update(payload).eq("id", plan.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "social", entity_type: "post", entity_id: plan.id, verb: "updated", summary: `Updated ${platform} post` });
    } else {
      const { data, error } = await supabase.from("social_plans").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "social", entity_type: "post", entity_id: data.id, verb: "created", summary: `Planned ${platform} post` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{plan ? "Edit post" : "New post"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Scheduled at</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Approval</Label>
              <Select value={approval} onValueChange={(v) => setApproval(v as ApprovalStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_approved">Not approved</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Post status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PostStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_posted">Not posted</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Copy</Label><Textarea rows={6} value={copy} onChange={(e) => setCopy(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Media</Label>
            <Input type="file" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            {mediaPath && <p className="text-xs text-muted-foreground">Attached: {mediaPath}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
