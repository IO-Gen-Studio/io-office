import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type Ev = { date: string; label: string; kind: "milestone" | "post" | "renewal" | "project" };

function CalendarPage() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const load = async () => {
      const [{ data: ms }, { data: sp }, { data: subs }, { data: pr }] = await Promise.all([
        supabase.from("milestones").select("label,due_date").not("due_date", "is", null),
        supabase.from("social_plans").select("platform,scheduled_at,copy").not("scheduled_at", "is", null),
        supabase.from("subscriptions").select("plan_name,renewal_date").not("renewal_date", "is", null),
        supabase.from("projects").select("title,end_date").not("end_date", "is", null),
      ]);
      const out: Ev[] = [];
      (ms ?? []).forEach((m) => out.push({ date: m.due_date as string, label: `Milestone: ${m.label}`, kind: "milestone" }));
      (sp ?? []).forEach((s) => out.push({ date: (s.scheduled_at as string).slice(0, 10), label: `${s.platform}: ${(s.copy as string).slice(0, 40)}`, kind: "post" }));
      (subs ?? []).forEach((s) => out.push({ date: s.renewal_date as string, label: `Renewal: ${s.plan_name}`, kind: "renewal" }));
      (pr ?? []).forEach((p) => out.push({ date: p.end_date as string, label: `Due: ${p.title}`, kind: "project" }));
      setEvents(out);
    };
    void load();
  }, []);

  const { year, month, days, firstDow } = useMemo(() => {
    const y = cursor.getFullYear(); const m = cursor.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    return { year: y, month: m, days: Array.from({ length: lastDate }, (_, i) => i + 1), firstDow: new Date(y, m, 1).getDay() };
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    events.forEach((e) => {
      const arr = map.get(e.date) ?? []; arr.push(e); map.set(e.date, arr);
    });
    return map;
  }, [events]);

  const monthName = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);

  const kindColor: Record<Ev["kind"], string> = {
    milestone: "bg-primary/15 text-primary",
    post: "bg-accent text-accent-foreground",
    renewal: "bg-secondary text-secondary-foreground",
    project: "bg-muted text-foreground",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Milestones, posts, renewals and deadlines.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <div className="font-medium w-40 text-center">{monthName}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map((d) => {
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const evs = byDay.get(dateStr) ?? [];
              const isToday = dateStr === today;
              return (
                <div key={d} className={`min-h-24 rounded-lg border p-1.5 ${isToday ? "border-primary bg-primary/5" : "bg-card"}`}>
                  <div className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
                  <div className="space-y-0.5 mt-1">
                    {evs.slice(0, 3).map((e, i) => (
                      <Badge key={i} variant="secondary" className={`text-[10px] block truncate w-full justify-start ${kindColor[e.kind]}`} title={e.label}>{e.label}</Badge>
                    ))}
                    {evs.length > 3 && <p className="text-[10px] text-muted-foreground">+{evs.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
