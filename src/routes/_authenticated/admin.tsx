import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminMarkEnquiriesRead,
  adminMarkMessagesRead,
  adminMessageInbox,
  adminPublicEnquiries,
  adminReplyToApplicant,
  bulkReviewApplicants,
  createUpdatePost,
  fetchApplicationPeriod,
  getApplicant,
  listApplicants,
  reviewApplicant,
  saveApplicationPeriod,
  setEmploymentStatus,
  updatePassword,
  updateSecurityQuestion,
} from "@/lib/portal.functions";
import { PortalAppHeader, PortalFooter } from "@/components/PortalChrome";
import { AssistantBanner, AssistantChat } from "@/components/AssistantChat";
import { UpdatesFeed } from "@/components/UpdatesFeed";
import { EMPLOYMENT_LABELS, SECURITY_QUESTIONS } from "@/lib/portal-data";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const title = "Admin Dashboard — WILLIE LAB TECH";
const description = "Review Willie Lab Tech applicants, decisions, messages and analytics.";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>): { v?: string } => ({
    v: typeof search.v === "string" ? search.v : undefined,
  }),
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
  component: AdminDashboard,
});

const MENU = [
  { key: "home", label: "Home" },
  { key: "all", label: "All Applicants" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "pending", label: "Pending" },
  { key: "messages", label: "Feedback / Messages" },
  { key: "assistant", label: "Research Assistant" },
  { key: "period", label: "Manage Application Period" },
  { key: "notifications", label: "Notifications" },
  { key: "settings", label: "Settings" },
];

type Applicant = Awaited<ReturnType<typeof listApplicants>>["applicants"][number];
type Detail = Awaited<ReturnType<typeof getApplicant>>;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    accepted: "bg-primary text-primary-foreground",
    rejected: "bg-destructive text-destructive-foreground",
    pending: "bg-accent text-accent-foreground",
  };
  return <Badge className={map[status] ?? map.pending}>{status.toUpperCase()}</Badge>;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listApplicants);
  const fetchOne = useServerFn(getApplicant);
  const review = useServerFn(reviewApplicant);
  const bulkReview = useServerFn(bulkReviewApplicants);
  const setEmployment = useServerFn(setEmploymentStatus);
  const fetchInbox = useServerFn(adminMessageInbox);
  const markInbox = useServerFn(adminMarkMessagesRead);
  const replyTo = useServerFn(adminReplyToApplicant);
  const loadPeriod = useServerFn(fetchApplicationPeriod);
  const savePeriod = useServerFn(saveApplicationPeriod);
  const changePwd = useServerFn(updatePassword);
  const changeQuestion = useServerFn(updateSecurityQuestion);
  const ask = useServerFn(assistantAsk);
  const listThreads = useServerFn(assistantThreads);
  const loadThreadMessages = useServerFn(assistantThreadMessages);

  const routeSearch = Route.useSearch();
  const view = routeSearch.v ?? "home";
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [totals, setTotals] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    thisWeek: 0,
    acceptanceRate: 0,
    employed: 0,
  });
  const [inbox, setInbox] = useState<Awaited<ReturnType<typeof adminMessageInbox>>["messages"]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [notes, setNotes] = useState<{ id: string; title: string; message: string; read: boolean; created_at: string }[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const [period, setPeriod] = useState({ deadline: "", manuallyClosed: false, open: true });
  const [deadlineInput, setDeadlineInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");

  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ id: string; role: string; content: string }[]>([]);
  const [assistantInput, setAssistantInput] = useState("");

  function setView(key: string) {
    setDetail(null);
    setSelected([]);
    navigate({ to: "/admin", search: { v: key } });
  }

  const load = useCallback(async () => {
    try {
      const [list, box, auth] = await Promise.all([fetchList({}), fetchInbox({}), supabase.auth.getUser()]);
      setApplicants(list.applicants);
      setTotals(list.totals);
      setInbox(box.messages);
      setInboxUnread(box.unread);
      if (auth.data.user) {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", auth.data.user.id)
          .order("created_at", { ascending: false });
        setNotes((data ?? []) as typeof notes);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin data.");
    }
  }, [fetchList, fetchInbox]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPeriod().then((p) => {
      setPeriod(p);
      setDeadlineInput(p.deadline.slice(0, 10));
    });
  }, [loadPeriod]);

  useEffect(() => {
    if (view !== "assistant") return;
    void listThreads().then((t) => setThreads(t as { id: string; title: string }[]));
  }, [view, listThreads]);

  async function applyPeriod(patch: { deadline?: string; manuallyClosed?: boolean }) {
    setBusy(true);
    try {
      const next = await savePeriod({ data: patch });
      setPeriod(next);
      setDeadlineInput(next.deadline.slice(0, 10));
      toast.success("Application period updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the period.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await changePwd({ data: { newPassword } });
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion() {
    if (answer.trim().length < 2) return toast.error("Enter your answer.");
    setBusy(true);
    try {
      await changeQuestion({ data: { question, answer } });
      setAnswer("");
      toast.success("Security question updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your security question.");
    } finally {
      setBusy(false);
    }
  }

  async function publishPost() {
    const body = postBody.trim();
    if (!body) return toast.error("Add some text before posting.");
    setBusy(true);
    try {
      const media: { path: string; type: string; name: string }[] = [];
      for (const item of postFiles) {
        const path = `posts/${Date.now()}-${item.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("posts").upload(path, item);
        if (error) throw new Error(error.message);
        media.push({ path, name: item.name, type: item.type || "application/octet-stream" });
      }
      await addPost({
        data: { body, audience: audience as "all", media },
      });
      setPostBody("");
      setPostFiles([]);
      toast.success("Update posted.");
      setView("home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the post.");
    } finally {
      setBusy(false);
    }
  }


  const unreadNotes = notes.filter((n) => !n.read).length;
  const bellCount = unreadNotes + inboxUnread;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = applicants;
    if (view === "accepted") rows = rows.filter((a) => a.status === "accepted");
    if (view === "rejected") rows = rows.filter((a) => a.status === "rejected");
    if (view === "pending") rows = rows.filter((a) => a.status === "pending");
    if (!term) return rows;
    return rows.filter((a) =>
      [a.full_name, a.email, a.engineering_field ?? "", a.status].join(" ").toLowerCase().includes(term),
    );
  }, [applicants, search, view]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/admin-login", replace: true });
  }

  async function openApplicant(id: string) {
    try {
      setDetail(await fetchOne({ data: { applicantId: id } }));
      setReason("");
      setReply("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open applicant.");
    }
  }

  async function decide(applicantId: string, decision: "accepted" | "rejected") {
    setBusy(true);
    try {
      await review({ data: { applicantId, decision, reason: reason.trim() || undefined } });
      toast.success(`Applicant ${decision}.`);
      setDetail(null);
      setReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function decideBulk(decision: "accepted" | "rejected") {
    if (!selected.length) return toast.error("Select at least one applicant.");
    setBusy(true);
    try {
      const result = await bulkReview({ data: { applicantIds: selected, decision, reason: reason.trim() || undefined } });
      toast.success(`${result.done} applicant(s) ${decision}.${result.failed ? ` ${result.failed} skipped.` : ""}`);
      setSelected([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = ["Name", "Email", "Field", "Qualification", "State", "Status", "Employment", "Submitted"];
    const rows = applicants.map((a) => [
      a.full_name,
      a.email,
      a.engineering_field ?? "",
      a.qualification ?? "",
      a.state ?? "",
      a.status,
      a.employment_status,
      a.submitted_at ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "willie-lab-tech-applicants.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const boxes = [
    { key: "all", label: "All Applicants", value: totals.total },
    { key: "accepted", label: "Accepted", value: totals.accepted },
    { key: "rejected", label: "Rejected", value: totals.rejected },
    { key: "pending", label: "Pending", value: totals.pending },
  ];

  const listView = (
    <section className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h1 className="truncate text-xl font-bold text-primary capitalize sm:text-2xl">
          {view === "all" ? "All applicants" : `${view} applicants`}
        </h1>
        <Button variant="outline" className="shrink-0 border-primary text-primary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <Input
        className="mt-4"
        placeholder="Search by name, email, engineering field or status"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {view === "pending" && filtered.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-lg bg-secondary p-3">
          <p className="text-sm font-semibold text-primary">Bulk action on {selected.length} selected</p>
          <Textarea rows={2} placeholder="Optional reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => decideBulk("accepted")} className="bg-primary text-primary-foreground">
              Accept selected
            </Button>
            <Button disabled={busy} variant="destructive" onClick={() => decideBulk("rejected")}>
              Reject selected
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">No applicants here.</li>
        ) : (
          filtered.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border bg-secondary p-3">
              {view === "pending" ? (
                <Checkbox
                  checked={selected.includes(a.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v === true ? [...prev, a.id] : prev.filter((id) => id !== a.id)))
                  }
                />
              ) : null}
              <button type="button" onClick={() => openApplicant(a.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold text-primary">{a.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.email} · {a.engineering_field ?? "No field"}
                </p>
              </button>
              <StatusBadge status={a.status} />
            </li>
          ))
        )}
      </ul>
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalAppHeader
        subtitle="Admin portal"
        items={MENU}
        active={view}
        unread={bellCount}
        onSelect={setView}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {detail ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <button type="button" onClick={() => setDetail(null)} className="text-sm font-semibold text-primary underline">
              ← Back
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-accent">
                {detail.avatarUrl ? (
                  <img src={detail.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-primary">{detail.profile.full_name.charAt(0)}</span>
                )}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-primary">{detail.profile.full_name}</h1>
                <p className="truncate text-sm text-muted-foreground">{detail.profile.email}</p>
              </div>
              <StatusBadge status={detail.profile.status} />
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Phone", detail.profile.phone ?? "-"],
                ["Gender", detail.profile.gender ?? "-"],
                ["Date of birth", detail.profile.date_of_birth ?? "-"],
                ["State", detail.profile.state ?? "-"],
                ["LGA", detail.profile.lga ?? "-"],
                ["Engineering field", detail.profile.engineering_field ?? "-"],
                ["Qualification", detail.profile.qualification ?? "-"],
                ["Years of experience", detail.profile.years_experience ?? "-"],
                ["Employment", EMPLOYMENT_LABELS[detail.profile.employment_status] ?? detail.profile.employment_status],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-secondary p-3">
                  <dt className="text-xs font-semibold text-muted-foreground uppercase">{k}</dt>
                  <dd className="text-sm font-medium">{v as string}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 rounded-lg bg-secondary p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Skills / notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{detail.profile.notes ?? "-"}</p>
            </div>

            <div className="mt-4 rounded-lg bg-secondary p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Experience</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{detail.profile.experience_notes ?? "-"}</p>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-primary">Documents</p>
              <ul className="mt-2 space-y-2">
                {detail.documents.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No documents.</li>
                ) : (
                  detail.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{doc.file_name}</span>
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary underline">
                          View
                        </a>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {detail.profile.status === "pending" ? (
              <div className="mt-5 space-y-2 rounded-lg border-2 border-accent p-4">
                <p className="text-sm font-semibold text-primary">Decision</p>
                <Textarea rows={2} placeholder="Optional reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => decide(detail.profile.id, "accepted")} className="bg-primary text-primary-foreground">
                    Accept
                  </Button>
                  <Button disabled={busy} variant="destructive" onClick={() => decide(detail.profile.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg bg-secondary p-4 text-sm">
                Decision recorded: <strong className="uppercase">{detail.profile.status}</strong>
                {detail.profile.review_reason ? ` — ${detail.profile.review_reason}` : ""}
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-lg border p-4">
              <p className="text-sm font-semibold text-primary">Employment status</p>
              <Select
                value={detail.profile.employment_status}
                onValueChange={async (value) => {
                  await setEmployment({
                    data: {
                      applicantId: detail.profile.id,
                      employmentStatus: value as "pending" | "employed" | "not_qualified",
                    },
                  });
                  toast.success("Employment status updated.");
                  await openApplicant(detail.profile.id);
                  await load();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="employed">Employed</SelectItem>
                  <SelectItem value="not_qualified">Not qualified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-5 space-y-2 rounded-lg border p-4">
              <p className="text-sm font-semibold text-primary">Conversation</p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-secondary p-3">
                {detail.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  detail.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        m.sender === "admin" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="mt-1 text-[11px] opacity-70">{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
              <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to this applicant..." />
              <Button
                disabled={busy || !reply.trim()}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await replyTo({ data: { applicantId: detail.profile.id, body: reply.trim() } });
                    toast.success("Message sent.");
                    setReply("");
                    await openApplicant(detail.profile.id);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not send.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send
              </Button>
            </div>
          </section>
        ) : view === "home" ? (
          <div className="space-y-6">
            <section className="rounded-xl bg-hero p-6 text-primary-foreground shadow-soft">
              <h1 className="text-2xl font-bold sm:text-3xl">Admin dashboard</h1>
              <p className="mt-1 text-sm opacity-90">Review submitted applications and respond to applicants.</p>
            </section>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {boxes.map((box) => (
                <button
                  key={box.key}
                  type="button"
                  onClick={() => setView(box.key)}
                  className="rounded-xl border-t-4 border-accent bg-card p-4 text-left shadow-soft"
                >
                  <p className="text-3xl font-bold text-primary">{box.value}</p>
                  <p className="text-sm text-muted-foreground">{box.label}</p>
                </button>
              ))}
            </div>

            <section className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="text-lg font-bold text-primary">Analytics</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-2xl font-bold text-primary">{totals.thisWeek}</p>
                  <p className="text-xs text-muted-foreground">Applications this week</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-2xl font-bold text-primary">{totals.acceptanceRate}%</p>
                  <p className="text-xs text-muted-foreground">Acceptance rate</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-2xl font-bold text-primary">{totals.employed}</p>
                  <p className="text-xs text-muted-foreground">Employed applicants</p>
                </div>
              </div>
            </section>
          </div>
        ) : view === "messages" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-primary sm:text-2xl">Applicant messages</h1>
              <Button
                variant="outline"
                className="border-primary text-primary"
                onClick={async () => {
                  await markInbox({});
                  await load();
                }}
              >
                Mark all read
              </Button>
            </div>
            <ul className="mt-4 space-y-2">
              {inbox.length === 0 ? (
                <li className="text-sm text-muted-foreground">No messages yet.</li>
              ) : (
                inbox.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => openApplicant(m.user_id)}
                      className={`w-full rounded-lg p-4 text-left ${
                        m.read_by_admin ? "border bg-secondary" : "border-l-4 border-accent bg-card shadow-soft"
                      }`}
                    >
                      <p className="font-semibold text-primary">{m.full_name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : view === "period" ? (
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">Manage application period</h1>
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-sm">
                Applications are currently{" "}
                <strong className={period.open ? "text-primary" : "text-destructive"}>
                  {period.open ? "OPEN" : "CLOSED"}
                </strong>
                . Closing date:{" "}
                <strong>{period.deadline ? new Date(period.deadline).toLocaleDateString() : "—"}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Closing date</Label>
              <Input
                id="deadline"
                type="date"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
              />
              <Button
                disabled={busy || !deadlineInput}
                onClick={() => applyPeriod({ deadline: `${deadlineInput}T23:59:59+01:00` })}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Save / extend deadline
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                disabled={busy || period.manuallyClosed}
                variant="destructive"
                onClick={() => applyPeriod({ manuallyClosed: true })}
              >
                Close applications now
              </Button>
              <Button
                disabled={busy || !period.manuallyClosed}
                onClick={() => applyPeriod({ manuallyClosed: false })}
                className="bg-primary text-primary-foreground"
              >
                Reopen applications
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Closing applications only blocks new registrations and new submissions. Existing applicants and the admin
              keep full access to the portal.
            </p>
          </section>
        ) : view === "enquiries" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-primary sm:text-2xl">Public enquiries</h1>
              <Button
                variant="outline"
                className="border-primary text-primary"
                onClick={async () => {
                  await markEnquiries({});
                  await loadEnquiries();
                }}
              >
                Mark all read
              </Button>
            </div>
            <ul className="mt-4 space-y-2">
              {enquiries.length === 0 ? (
                <li className="text-sm text-muted-foreground">No enquiries yet.</li>
              ) : (
                enquiries.map((e) => (
                  <li
                    key={e.id}
                    className={`rounded-lg p-4 ${
                      e.read_by_admin ? "border bg-secondary" : "border-l-4 border-accent bg-card shadow-soft"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap text-foreground">{e.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {e.gender} · contact: <span className="font-semibold text-primary">{e.contact}</span> ·{" "}
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : view === "compose" ? (
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">Share your mind or post new updates</h1>
            <Textarea
              rows={7}
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="Write your update..."
            />
            <div className="space-y-2">
              <Label htmlFor="post-media">Photos or videos (optional)</Label>
              <Input
                id="post-media"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => setPostFiles(Array.from(e.target.files ?? []))}
              />
              {postFiles.length > 0 ? (
                <p className="text-xs text-muted-foreground">{postFiles.length} file(s) selected</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Who can see this post?</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All applicants / users</SelectItem>
                  <SelectItem value="accepted">Accepted applicants</SelectItem>
                  <SelectItem value="pending">Pending applicants</SelectItem>
                  <SelectItem value="rejected">Rejected applicants</SelectItem>
                  <SelectItem value="employed">Employed applicants</SelectItem>
                  <SelectItem value="unemployed">Unemployed applicants</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {postFiles.length > 0 && !postBody.trim() ? (
              <p className="text-sm font-semibold text-destructive">
                Add some text before posting a photo or video.
              </p>
            ) : null}
            <Button
              disabled={busy || !postBody.trim()}
              onClick={publishPost}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {busy ? "Posting…" : "Post update"}
            </Button>
          </section>
        ) : view === "assistant" ? (
          <AssistantChat />

        ) : view === "settings" ? (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Settings</h1>
            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="font-bold text-primary">Change password</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="anp">New password</Label>
                  <Input id="anp" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acp">Confirm new password</Label>
                  <Input
                    id="acp"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button disabled={busy} onClick={savePassword} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                Update password
              </Button>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="font-bold text-primary">Security question</h2>
              <div className="mt-3 space-y-3">
                <Select value={question} onValueChange={setQuestion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECURITY_QUESTIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
              </div>
              <Button disabled={busy} onClick={saveQuestion} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                Save security question
              </Button>
            </div>
          </section>
        ) : view === "notifications" ? (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Notifications</h1>
            <div>
              <h2 className="font-semibold text-primary">Unread ({unreadNotes})</h2>
              <ul className="mt-2 space-y-2">
                {notes.filter((n) => !n.read).length === 0 ? (
                  <li className="text-sm text-muted-foreground">Nothing unread.</li>
                ) : (
                  notes.filter((n) => !n.read).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          await supabase.from("notifications").update({ read: true }).eq("id", n.id);
                          setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                        }}
                        className="w-full rounded-lg border-l-4 border-accent bg-card p-4 text-left shadow-soft"
                      >
                        <p className="font-semibold text-primary">{n.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h2 className="font-semibold text-primary">Read</h2>
              <ul className="mt-2 space-y-2">
                {notes.filter((n) => n.read).map((n) => (
                  <li key={n.id} className="rounded-lg border bg-secondary p-4">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          listView
        )}
      </main>
      <PortalFooter />
    </div>
  );
}
