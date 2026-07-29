import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getApplicant, listApplicants, reviewApplicant } from "@/lib/portal.functions";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const title = "Admin Dashboard — WILLIE LAB TECH";
const description = "Review and manage applications to the Willie Lab Tech engineering empowerment.";

export const Route = createFileRoute("/_authenticated/admin")({
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
  component: AdminPage,
});

const statusStyles: Record<string, string> = {
  pending: "bg-accent text-accent-foreground",
  accepted: "bg-primary text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchApplicants = useServerFn(listApplicants);
  const fetchApplicant = useServerFn(getApplicant);
  const review = useServerFn(reviewApplicant);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const listQuery = useQuery({
    queryKey: ["admin-applicants"],
    queryFn: () => fetchApplicants({}),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-applicant", selected],
    enabled: !!selected,
    queryFn: () => fetchApplicant({ data: { applicantId: selected! } }),
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: "accepted" | "rejected") =>
      review({ data: { applicantId: selected!, decision, reason: reason.trim() || undefined } }),
    onSuccess: (_data, decision) => {
      toast.success(`Applicant ${decision}. Notification sent to the portal.`);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-applicants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-applicant", selected] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Action failed."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin-login", replace: true });
  }

  if (listQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PortalHeader subtitle="Admin" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-center">
          <h1 className="text-2xl font-bold text-primary">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This account is not an administrator of the portal.
          </p>
          <Button className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90" onClick={signOut}>
            Back to admin login
          </Button>
        </main>
        <PortalFooter />
      </div>
    );
  }

  const totals = listQuery.data?.totals;
  const detail = detailQuery.data;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Admin" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <section className="flex flex-wrap items-center gap-3 rounded-xl bg-hero p-5 text-primary-foreground shadow-soft">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Admin dashboard</h1>
            <p className="text-sm opacity-90">Willie Lab Tech empowerment applications</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={signOut}
          >
            Logout
          </Button>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total applicants", value: totals?.total ?? 0 },
            { label: "Pending", value: totals?.pending ?? 0 },
            { label: "Accepted", value: totals?.accepted ?? 0 },
            { label: "Rejected", value: totals?.rejected ?? 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border-t-4 border-accent bg-card p-4 shadow-soft">
              <p className="text-3xl font-bold text-primary">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="text-xl font-bold text-primary">Applicants</h2>
          <div className="mt-3 divide-y">
            {listQuery.isLoading ? (
              <p className="py-3 text-sm text-muted-foreground">Loading applicants...</p>
            ) : (listQuery.data?.applicants ?? []).length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No applicants yet.</p>
            ) : (
              (listQuery.data?.applicants ?? []).map((applicant) => (
                <button
                  key={applicant.id}
                  onClick={() => setSelected(applicant.id)}
                  className={`flex w-full flex-wrap items-center gap-3 py-3 text-left transition-colors hover:bg-secondary ${
                    selected === applicant.id ? "bg-secondary" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{applicant.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{applicant.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusStyles[applicant.status]}`}
                  >
                    {applicant.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {selected ? (
          <section className="rounded-xl border-t-4 border-accent bg-card p-5 shadow-soft">
            <h2 className="text-xl font-bold text-primary">Applicant details</h2>
            {detailQuery.isLoading || !detail ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading details...</p>
            ) : (
              <>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Full name", detail.profile.full_name],
                    ["Email", detail.profile.email],
                    ["Gender", detail.profile.gender],
                    ["Date of birth", detail.profile.date_of_birth],
                    ["State", detail.profile.state],
                    ["LGA", detail.profile.lga],
                    ["Qualification", detail.profile.qualification],
                    ["Status", detail.profile.status],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-md bg-secondary p-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{(value as string) || "—"}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 rounded-md bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">Notes / Skills</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{detail.profile.notes || "—"}</p>
                </div>

                <h3 className="mt-5 font-bold text-primary">Documents</h3>
                <ul className="mt-2 space-y-2">
                  {detail.documents.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No documents uploaded.</li>
                  ) : (
                    detail.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-md border bg-secondary px-3 py-2"
                      >
                        <span className="truncate text-sm">{doc.file_name}</span>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-primary underline"
                          >
                            View
                          </a>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>

                <div className="mt-5 space-y-3">
                  <Textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Optional reason / feedback (shown only inside the applicant's dashboard)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate("accepted")}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate("rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}
      </main>
      <PortalFooter />
    </div>
  );
}
