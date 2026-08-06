import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { registerApplicant } from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { SECURITY_QUESTIONS } from "@/lib/portal-data";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const nameParts = fullName.trim().split(/\s+/).filter((p) => p.length >= 2);
  const nameInvalid = fullName.length > 0 && nameParts.length < 3;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nameParts.length < 3) {
      return toast.error("Please enter your full name (first, middle, and surname).");
    }
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (answer.trim().length < 2) return toast.error("Please answer your security question.");

    setLoading(true);
    try {
      await register({
        data: { fullName, email, password, securityQuestion: question, securityAnswer: answer },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        toast.success("Your account has been created. Please log in.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("Your account has been created successfully.");
      navigate({ to: "/dashboard", replace: true });
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
            <Label htmlFor="fullName">Full Name (first, middle and surname)</Label>
            <Input
              id="fullName"
              value={fullName}
              maxLength={120}
              aria-invalid={nameInvalid}
              placeholder="e.g. Emeka John Okafor"
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            {nameInvalid ? (
              <p className="text-xs font-semibold text-destructive">
                Please enter your full name (first, middle, and surname).
              </p>
            ) : null}
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
            <p className="text-xs text-muted-foreground">At least 8 characters. Stored securely and encrypted.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              maxLength={72}
              aria-invalid={mismatch}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {mismatch ? <p className="text-xs font-semibold text-destructive">Passwords do not match</p> : null}
          </div>

          <div className="space-y-2 rounded-lg bg-secondary p-3">
            <Label>Security question (used to recover your password)</Label>
            <Select value={question} onValueChange={setQuestion}>
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_QUESTIONS.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label htmlFor="answer">Your answer</Label>
            <Input
              id="answer"
              className="bg-card"
              value={answer}
              maxLength={120}
              onChange={(e) => setAnswer(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || mismatch || !confirmPassword}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
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
