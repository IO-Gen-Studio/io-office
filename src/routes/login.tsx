import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import logoUrl from "@/assets/io-gen-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset email sent if account exists");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-elegant border-border/60">
        <CardHeader className="space-y-1">
          <div className="flex justify-center py-2">
            <img src={logoUrl} alt="IO-Gen" className="h-16 w-auto object-contain" />
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {mode === "login" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
            )}
            <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary text-primary-foreground">
              {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Send reset link"}
            </Button>
            {mode === "login" ? (
              <div className="text-center">
                <button type="button" className="text-xs text-primary hover:underline"
                  onClick={() => setMode("forgot")}>Forgot password?</button>
              </div>
            ) : (
              <button type="button" className="w-full text-xs text-muted-foreground hover:underline"
                onClick={() => setMode("login")}>Back to sign in</button>
            )}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Accounts are created by an administrator. Contact your admin if you need access.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
