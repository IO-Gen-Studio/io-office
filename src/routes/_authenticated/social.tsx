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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { SocialPostMockupDialog } from "@/components/SocialPostMockup";
import { useBuiltinFieldLabel, useBuiltinFieldOptions } from "@/lib/builtin-labels";

type Platform = Database["public"]["Enums"]["social_platform"];
type PostStatus = Database["public"]["Enums"]["post_status"];
type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

const PLATFORMS: Platform[] = ["linkedin", "instagram", "x", "threads", "facebook", "tiktok", "youtube"];

type Plan = {
  id: string; platform: Platform; title: string; copy: string; media_path: string | null;
  scheduled_at: string | null; post_status: PostStatus; approval_status: ApprovalStatus;
  custom?: Record<string, unknown> | null;
};

export const Route = createFileRoute("/_authenticated/social")({ component: SocialPage });

function SocialPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("social");
  const [rows, setRows] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [viewing, setViewing] = useState<Plan | null>(null);

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
  const platformLabel = useBuiltinFieldLabel("social", "platform");
  const approvalLabel = useBuiltinFieldLabel("social", "approval_status");
  const postStatusLabel = useBuiltinFieldLabel("social", "post_status");

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
              <TableHead>Platform</TableHead><TableHead>Title</TableHead><TableHead>Copy</TableHead><TableHead>Scheduled</TableHead>
              <TableHead>Approval</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No posts planned.</TableCell></TableRow> :
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="secondary">{platformLabel(p.platform)}</Badge></TableCell>
                    <TableCell className="font-medium">{p.title || "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">{p.copy || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{p.approval_status === "approved" ? <Badge>{approvalLabel("approved")}</Badge> : <Badge variant="outline">{approvalLabel("not_approved")}</Badge>}</TableCell>
                    <TableCell><Badge variant={p.post_status === "posted" ? "default" : p.post_status === "cancelled" ? "destructive" : "secondary"}>{postStatusLabel(p.post_status)}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Preview" onClick={() => setViewing(p)}><Eye className="size-4" /></Button>
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
      <SocialPostMockupDialog
        open={!!viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        plan={viewing ? (rows.find((r) => r.id === viewing.id) ?? viewing) : null}
        editable={editable}
        onApprovalChange={load}
      />
    </div>
  );
}

function PlanDialog({ open, onOpenChange, plan, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; plan: Plan | null; onSaved: () => void }) {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState(""); const [scheduledAt, setScheduledAt] = useState("");
  const [approval, setApproval] = useState<ApprovalStatus>("not_approved");
  const [status, setStatus] = useState<PostStatus>("not_posted");
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [custom, setCustom] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setPlatform(plan?.platform ?? "linkedin");
    setTitle(plan?.title ?? "");
    setCopy(plan?.copy ?? "");
    setScheduledAt(plan?.scheduled_at ? new Date(plan.scheduled_at).toISOString().slice(0, 10) : "");
    setApproval(plan?.approval_status ?? "not_approved");
    setStatus(plan?.post_status ?? "not_posted");
    setMediaPath(plan?.media_path ?? null);
    setCustom((plan?.custom as Record<string, unknown>) ?? {});
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
      platform, title, copy, media_path: mediaPath,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      approval_status: approval, post_status: status,
      custom: custom as never,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>{plan ? "Edit post" : "New post"}</SheetTitle></SheetHeader>
        <div className="space-y-3">
          <PlanDialogSelects platform={platform} setPlatform={setPlatform} approval={approval} setApproval={setApproval} status={status} setStatus={setStatus} scheduledAt={scheduledAt} setScheduledAt={setScheduledAt} />
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Copy</Label><Textarea rows={6} value={copy} onChange={(e) => setCopy(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Media (image, video or PDF)</Label>
            <Input type="file" accept="image/*,video/*,application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            {mediaPath && <MediaPreview path={mediaPath} onRemove={() => setMediaPath(null)} />}
          </div>
          <CustomFieldValues module="social" value={custom} onChange={setCustom} />
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MediaPreview({ path, onRemove }: { path: string; onRemove: () => void }) {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const { data } = supabase.storage.from("social-media").getPublicUrl(path);
  const url = data.publicUrl;
  const isPdf = ext === "pdf";
  const isVideo = ["mp4", "webm", "mov", "m4v", "ogg"].includes(ext);
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext);
  return (
    <div className="space-y-2 rounded-md border p-2 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate flex-1">{path}</a>
        <Button variant="ghost" size="sm" type="button" onClick={onRemove}>Remove</Button>
      </div>
      <div className="rounded overflow-hidden bg-background">
        {isPdf ? (
          <iframe src={url} title="PDF preview" className="w-full h-80 border-0" />
        ) : isVideo ? (
          <video src={url} controls className="w-full max-h-80" />
        ) : isImage ? (
          <img src={url} alt="Media preview" className="w-full max-h-80 object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground p-3">Preview not available for this file type.</p>
        )}
      </div>
    </div>
  );
}
