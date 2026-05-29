import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings/profile")({ component: Profile });

function Profile() {
  const { profile, user } = useAuth();
  return (
    <Card className="shadow-soft">
      <CardHeader><CardTitle>Your profile</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div><span className="text-muted-foreground">Name: </span>{profile?.full_name || "—"}</div>
        <div><span className="text-muted-foreground">Email: </span>{user?.email}</div>
        <div><span className="text-muted-foreground">Job title: </span>{profile?.job_title || "—"}</div>
      </CardContent>
    </Card>
  );
}
