import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resendCode, verifyAccount } from "@/lib/portal.functions";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "Verify your account — WILLIE LAB TECH";
const description = "Enter the 6-digit verification code sent to your email to activate your applicant account.";

export const Route = createFileRoute("/verify")({
  validateSearch: z.object({ email: z.string().email().optional() }),
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
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const verify = useServerFn(verifyAccount);
  const resend = useServerFn(resendCode);
  const [email, setEmail] = useState(search.email ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await verify({ data: { email, code } });
      setDone(true);
      toast.success("Your account has been successfully created");
      setTimeout(() => navigate({ to: "/login" }), 1800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      const result = await resend({ data: { email } });
      if (result.fallbackCode) {
        toast.warning(`Email sending is not set up yet. Your code is ${result.fallbackCode}`, { duration: 20000 });
      } else {
        toast.success("A new code has been sent.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the code.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Verify" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        {done ? (
          <div className="rounded-xl border-l-4 border-accent bg-secondary p-6 text-center shadow-soft">
            <h1 className="text-2xl font-bold text-primary">Your account has been successfully created</h1>
            <p className="mt-2 text-sm text-muted-foreground">Taking you to the login page...</p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-primary">Verify your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the 6-digit code we sent to your email address.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-[0.5em]"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Verifying..." : "Verify account"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-primary" onClick={onResend}>
                Resend code
              </Button>
            </form>
          </>
        )}
      </main>
      <PortalFooter />
    </div>
  );
}
