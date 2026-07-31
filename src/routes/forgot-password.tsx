import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { fetchSecurityQuestion, resetPassword } from "@/lib/portal.functions";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "Reset Password — WILLIE LAB TECH";
const description =
  "Recover your Willie Lab Tech portal password by answering the security question you set during registration.";

export const Route = createFileRoute("/forgot-password")({
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
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const getQuestion = useServerFn(fetchSecurityQuestion);
  const doReset = useServerFn(resetPassword);

  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function findQuestion(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await getQuestion({ data: { email } });
      setQuestion(result.question);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not find that account.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPassword !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await doReset({ data: { email, answer, newPassword } });
      toast.success("Your password has been reset. Please log in.");
      navigate({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Password recovery" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold text-primary">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer the security question you chose when you registered.
        </p>

        {question === null ? (
          <form onSubmit={findQuestion} className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? "Checking..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Security question</p>
              <p className="text-sm font-medium">{question}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Your answer</Label>
              <Input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-primary underline">
            Back to login
          </Link>
        </p>
      </main>
      <PortalFooter />
    </div>
  );
}
