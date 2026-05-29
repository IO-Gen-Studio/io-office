import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { relativeTimeUK } from "@/lib/format";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotificationsPage });

type Notification = { id: string; title: string; body: string | null; type: string; link: string | null; read_at: string | null; created_at: string };

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    setItems((data ?? []) as Notification[]);
  };
  useEffect(() => { void load(); }, [user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", user.id);
    void load();
  };
  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    void load();
  };

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">{unread} unread</p>
        </div>
        {unread > 0 && <Button variant="outline" onClick={markAll}>Mark all read</Button>}
      </div>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Recent</CardTitle></CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="size-8 mx-auto mb-2 opacity-50" />
              <p>You're all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id} className={`p-4 flex gap-3 ${!n.read_at ? "bg-accent/30" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{n.title}</span>
                      {!n.read_at && <Badge variant="secondary" className="text-[10px] h-4">New</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{relativeTimeUK(n.created_at)}</p>
                  </div>
                  {!n.read_at && <Button variant="ghost" size="sm" onClick={() => markOne(n.id)}>Mark read</Button>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
