import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminAccount } from "@/lib/portal.functions";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "Admin Login — WILLIE LAB TECH";
const description = "Restricted administrator access to the Willie Lab Tech empowerment portal.";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();

  // Already signed in (e.g. arrived here with the phone back button): go straight back in.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);
  const ensureAdmin = useServerFn(ensureAdminAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await ensureAdmin({});
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error("Incorrect admin credentials.");

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!role) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }

      toast.success("Welcome, Admin.");
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Admin" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold text-primary">Administrator login</h1>
        <p className="mt-1 text-sm text-muted-foreground">Restricted area — authorised personnel only.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border-t-4 border-accent bg-card p-5 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="email">Admin email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? "Signing in..." : "Login as Admin"}
          </Button>
        </form>
      </main>
      <PortalFooter />
    </div>
  );
}
