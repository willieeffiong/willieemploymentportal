import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { registerApplicant } from "@/lib/portal.functions";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "Register — WILLIE LAB TECH Empowerment Portal";
const description =
  "Create your Willie Lab Tech applicant account to apply for the engineering empowerment programme.";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const register = useServerFn(registerApplicant);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 2) return toast.error("Please enter your full name.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const result = await register({ data: { fullName, email, password } });
      if (result.fallbackCode) {
        toast.warning(`Email sending is not set up yet. Your code is ${result.fallbackCode}`, {
          duration: 20000,
        });
      } else {
        toast.success("We sent a 6-digit code to your email.");
      }
      navigate({ to: "/verify", search: { email: email.trim().toLowerCase() } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Register" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold text-primary">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register to apply for the Willie Lab Tech empowerment.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              minLength={8}
              maxLength={72}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? "Creating account..." : "Register"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary underline">
              Login
            </Link>
          </p>
        </form>
      </main>
      <PortalFooter />
    </div>
  );
}
