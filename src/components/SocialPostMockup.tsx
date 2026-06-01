import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal, ThumbsUp, Send, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Platform = Database["public"]["Enums"]["social_platform"];
type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export type MockupPlan = {
  id: string;
  platform: Platform;
  title: string;
  copy: string;
  media_path: string | null;
  scheduled_at: string | null;
  approval_status: ApprovalStatus;
};

function mediaUrl(path: string | null): { url: string; kind: "image" | "video" | "pdf" | "other" } | null {
  if (!path) return null;
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const { data } = supabase.storage.from("social-media").getPublicUrl(path);
  let kind: "image" | "video" | "pdf" | "other" = "other";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext)) kind = "image";
  else if (["mp4", "webm", "mov", "m4v", "ogg"].includes(ext)) kind = "video";
  else if (ext === "pdf") kind = "pdf";
  return { url: data.publicUrl, kind };
}

function Media({ path, className }: { path: string | null; className?: string }) {
  const m = mediaUrl(path);
  if (!m) return null;
  if (m.kind === "image") return <img src={m.url} alt="Post media" className={className} />;
  if (m.kind === "video") return <video src={m.url} controls className={className} />;
  if (m.kind === "pdf") return <iframe src={m.url} title="PDF" className={className} />;
  return <a href={m.url} target="_blank" rel="noreferrer" className="text-primary underline text-sm p-3 block">Open attachment</a>;
}

function Avatar({ initials = "IO" }: { initials?: string }) {
  return (
    <div className="size-10 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center font-semibold text-sm shrink-0">
      {initials}
    </div>
  );
}

function InstagramMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-xl border bg-white text-zinc-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Avatar />
        <div className="flex-1 text-sm font-semibold">your.brand</div>
        <MoreHorizontal className="size-5" />
      </div>
      <div className="bg-zinc-100 aspect-square grid place-items-center overflow-hidden">
        {plan.media_path ? <Media path={plan.media_path} className="w-full h-full object-cover" /> : <span className="text-zinc-400 text-sm">No image</span>}
      </div>
      <div className="px-3 py-2 flex items-center gap-3">
        <Heart className="size-6" /><MessageCircle className="size-6" /><Send className="size-6" />
        <Bookmark className="size-6 ml-auto" />
      </div>
      <div className="px-3 pb-3 text-sm whitespace-pre-wrap"><span className="font-semibold mr-1">your.brand</span>{plan.copy}</div>
    </div>
  );
}

function LinkedInMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-lg border bg-white text-zinc-900 shadow-sm overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        <Avatar />
        <div className="flex-1">
          <div className="text-sm font-semibold">Your Brand</div>
          <div className="text-xs text-zinc-500">Company · {plan.scheduled_at ? new Date(plan.scheduled_at).toLocaleDateString() : "Now"} · 🌐</div>
        </div>
        <MoreHorizontal className="size-5 text-zinc-500" />
      </div>
      <div className="px-3 pb-3 text-sm whitespace-pre-wrap">{plan.copy}</div>
      {plan.media_path && <div className="bg-zinc-100"><Media path={plan.media_path} className="w-full max-h-[500px] object-cover" /></div>}
      <div className="border-t flex justify-around py-1 text-xs text-zinc-600">
        <button className="flex items-center gap-1 p-2"><ThumbsUp className="size-4" />Like</button>
        <button className="flex items-center gap-1 p-2"><MessageCircle className="size-4" />Comment</button>
        <button className="flex items-center gap-1 p-2"><Repeat2 className="size-4" />Repost</button>
        <button className="flex items-center gap-1 p-2"><Send className="size-4" />Send</button>
      </div>
    </div>
  );
}

function XMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-2xl border bg-black text-white shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <Avatar />
        <div className="flex-1">
          <div className="text-sm"><span className="font-bold">Your Brand</span> <span className="text-zinc-500">@yourbrand · {plan.scheduled_at ? new Date(plan.scheduled_at).toLocaleDateString() : "now"}</span></div>
          <div className="text-[15px] mt-1 whitespace-pre-wrap">{plan.copy}</div>
          {plan.media_path && <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800"><Media path={plan.media_path} className="w-full max-h-[420px] object-cover" /></div>}
          <div className="flex justify-between text-zinc-500 mt-3 max-w-[320px] text-xs">
            <MessageCircle className="size-4" /><Repeat2 className="size-4" /><Heart className="size-4" /><Share className="size-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FacebookMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-lg border bg-white text-zinc-900 shadow-sm overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        <Avatar />
        <div className="flex-1">
          <div className="text-sm font-semibold">Your Brand</div>
          <div className="text-xs text-zinc-500">{plan.scheduled_at ? new Date(plan.scheduled_at).toLocaleString() : "Just now"} · 🌐</div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[15px] whitespace-pre-wrap">{plan.copy}</div>
      {plan.media_path && <div className="bg-zinc-100"><Media path={plan.media_path} className="w-full max-h-[500px] object-cover" /></div>}
      <div className="border-t flex justify-around py-1 text-sm text-zinc-600">
        <button className="flex items-center gap-1 p-2"><ThumbsUp className="size-4" />Like</button>
        <button className="flex items-center gap-1 p-2"><MessageCircle className="size-4" />Comment</button>
        <button className="flex items-center gap-1 p-2"><Share className="size-4" />Share</button>
      </div>
    </div>
  );
}

function TikTokMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-[300px] aspect-[9/16] rounded-2xl border bg-black text-white relative overflow-hidden">
      {plan.media_path ? <Media path={plan.media_path} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-zinc-500">No video</div>}
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4">
        <Avatar />
        <Heart className="size-6" /><MessageCircle className="size-6" /><Share className="size-6" />
      </div>
      <div className="absolute left-3 right-12 bottom-3 text-sm">
        <div className="font-semibold">@yourbrand</div>
        <div className="line-clamp-3 whitespace-pre-wrap">{plan.copy}</div>
      </div>
    </div>
  );
}

function YouTubeMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-full max-w-[560px] rounded-lg border bg-white text-zinc-900 shadow-sm overflow-hidden">
      <div className="bg-black aspect-video grid place-items-center">
        {plan.media_path ? <Media path={plan.media_path} className="w-full h-full object-contain" /> : <span className="text-zinc-500 text-sm">No media</span>}
      </div>
      <div className="p-3 flex gap-3">
        <Avatar />
        <div className="flex-1">
          <div className="font-semibold text-sm leading-tight">{plan.title || "Untitled video"}</div>
          <div className="text-xs text-zinc-500">Your Brand · {plan.scheduled_at ? new Date(plan.scheduled_at).toLocaleDateString() : "Now"}</div>
          <div className="text-sm mt-2 whitespace-pre-wrap text-zinc-700">{plan.copy}</div>
        </div>
      </div>
    </div>
  );
}

function ThreadsMockup({ plan }: { plan: MockupPlan }) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-2xl border bg-white text-zinc-900 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <Avatar />
        <div className="flex-1">
          <div className="text-sm font-semibold">yourbrand</div>
          <div className="text-[15px] mt-1 whitespace-pre-wrap">{plan.copy}</div>
          {plan.media_path && <div className="mt-2 rounded-xl overflow-hidden border"><Media path={plan.media_path} className="w-full max-h-[420px] object-cover" /></div>}
          <div className="flex gap-4 text-zinc-500 mt-3 text-xs">
            <Heart className="size-4" /><MessageCircle className="size-4" /><Repeat2 className="size-4" /><Send className="size-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function renderMockup(plan: MockupPlan) {
  switch (plan.platform) {
    case "instagram": return <InstagramMockup plan={plan} />;
    case "linkedin": return <LinkedInMockup plan={plan} />;
    case "x": return <XMockup plan={plan} />;
    case "facebook": return <FacebookMockup plan={plan} />;
    case "tiktok": return <TikTokMockup plan={plan} />;
    case "youtube": return <YouTubeMockup plan={plan} />;
    case "threads": return <ThreadsMockup plan={plan} />;
    default: return <LinkedInMockup plan={plan} />;
  }
}

export function SocialPostMockupDialog({
  open, onOpenChange, plan, editable, onApprovalChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: MockupPlan | null;
  editable: boolean;
  onApprovalChange?: () => void;
}) {
  if (!plan) return null;
  const approved = plan.approval_status === "approved";
  const setApproval = async (next: ApprovalStatus) => {
    const { error } = await supabase.from("social_plans").update({ approval_status: next }).eq("id", plan.id);
    if (error) return;
    onApprovalChange?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preview <Badge variant="secondary" className="capitalize">{plan.platform}</Badge>
            {approved ? <Badge>Approved</Badge> : <Badge variant="outline">Not approved</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-muted/40 p-4 rounded-md">
          {renderMockup(plan)}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {editable && (approved ? (
            <Button variant="outline" onClick={() => setApproval("not_approved")}>Revoke approval</Button>
          ) : (
            <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setApproval("approved")}>Approve post</Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
