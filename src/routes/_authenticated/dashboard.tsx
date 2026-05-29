import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Activity, Users, Mail, Briefcase, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type ActivityRow = { id: string; module: string; verb: string; summary: string; actor_id: string | null; created_at: string };
type ProfileLite = { id: string; full_name: string };

function Dashboard() {
  const { profile } = useAuth();
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState({ contacts: 0, campaigns: 0, projects: 0, subscriptions: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: acts }, { data: profs }, { count: cContacts }, { count: cCampaigns }, { count: cProjects }, { count: cSubs }] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(25),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("contacts").select("*", { count: "exact", head: true }),
        supabase.from("campaigns").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      setActivity((acts ?? []) as ActivityRow[]);
      const map: Record<string, string> = {};
      (profs as ProfileLite[] | null)?.forEach((p) => { map[p.id] = p.full_name; });
      setActors(map);
      setCounts({ contacts: cContacts ?? 0, campaigns: cCampaigns ?? 0, projects: cProjects ?? 0, subscriptions: cSubs ?? 0 });
    })();
  }, []);

  const kpis = [
    { label: "Contacts", value: counts.contacts, icon: Users },
    { label: "Active campaigns", value: counts.campaigns, icon: Mail },
    { label: "Open projects", value: counts.projects, icon: Briefcase },
    { label: "Active subscriptions", value: counts.subscriptions, icon: CreditCard },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-soft">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground font-medium">{k.label}</CardTitle>
              <k.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-semibold text-gradient">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />Activity feed</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No activity yet. Create a contact, campaign or project to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => (
                <li key={a.id} className="p-4 flex items-start gap-3">
                  <div className="size-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{a.actor_id ? actors[a.actor_id] ?? "Someone" : "System"}</span>
                      <span className="text-muted-foreground"> {a.verb}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.summary}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] h-4 capitalize">{a.module}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
