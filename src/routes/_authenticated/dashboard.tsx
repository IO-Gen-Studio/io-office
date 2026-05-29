import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { profile } = useAuth();
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening across IO-Gen.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Active campaigns","Open projects","Upcoming renewals"].map((label) => (
          <Card key={label} className="shadow-soft">
            <CardHeader><CardTitle className="text-sm text-muted-foreground font-medium">{label}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold text-gradient">—</div></CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-soft">
        <CardHeader><CardTitle>Activity feed</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No activity yet. Start by creating a contact, campaign, or project.</p></CardContent>
      </Card>
    </div>
  );
}
