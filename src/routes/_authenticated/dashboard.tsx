import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { submitApplicationFn, sendMessageToAdmin } from "@/lib/portal.functions";
import { PortalAppHeader, PortalFooter } from "@/components/PortalChrome";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import {
  ENGINEERING_FIELDS,
  ENGINEERING_FIELD_NAMES,
  EMPLOYMENT_LABELS,
  NIGERIAN_STATES,
  QUALIFICATIONS,
} from "@/lib/portal-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const title = "Applicant Dashboard — WILLIE LAB TECH";
const description = "Manage your Willie Lab Tech empowerment application, documents and messages.";

export const Route = createFileRoute("/_authenticated/dashboard")({
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
  component: Dashboard,
});

const MENU = [
  { key: "home", label: "Home" },
  { key: "profile", label: "Profile" },
  { key: "application", label: "Application" },
  { key: "status", label: "Application Status" },
  { key: "employment", label: "Employment Status" },
  { key: "feedback", label: "Feedback / Chat" },
  { key: "notifications", label: "Notifications" },
];

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  state: string | null;
  lga: string | null;
  engineering_field: string | null;
  qualification: string | null;
  notes: string | null;
  status: "pending" | "accepted" | "rejected";
  employment_status: string;
  review_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  terms_accepted: boolean;
  avatar_url: string | null;
}

interface Doc {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
}

interface Note {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Msg {
  id: string;
  sender: string;
  body: string;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    accepted: "bg-primary text-primary-foreground",
    rejected: "bg-destructive text-destructive-foreground",
    pending: "bg-accent text-accent-foreground",
  };
  return <Badge className={map[status] ?? map.pending}>{status.toUpperCase()}</Badge>;
}

function Dashboard() {
  const navigate = useNavigate();
  const submitApp = useServerFn(submitApplicationFn);
  const sendMsg = useServerFn(sendMessageToAdmin);

  const [view, setView] = useState("home");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [reply, setReply] = useState("");
  const [chat, setChat] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    state: "",
    lga: "",
    engineering_field: "",
    qualification: "",
    notes: "",
    terms_accepted: false,
  });

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);

    const [{ data: p }, { data: d }, { data: n }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("documents").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: true }),
    ]);

    if (p) {
      const prof = p as unknown as Profile;
      setProfile(prof);
      setForm({
        full_name: prof.full_name ?? "",
        phone: prof.phone ?? "",
        gender: prof.gender ?? "",
        date_of_birth: prof.date_of_birth ?? "",
        state: prof.state ?? "",
        lga: prof.lga ?? "",
        engineering_field: prof.engineering_field ?? "",
        qualification: prof.qualification ?? "",
        notes: prof.notes ?? "",
        terms_accepted: prof.terms_accepted ?? false,
      });
      if (prof.avatar_url) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(prof.avatar_url, 3600);
        setAvatarSrc(signed?.signedUrl ?? null);
      } else {
        setAvatarSrc(null);
      }
    }
    setDocs((d ?? []) as Doc[]);
    setNotes((n ?? []) as Note[]);
    setMessages((m ?? []) as unknown as Msg[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = useMemo(() => notes.filter((n) => !n.read).length, [notes]);
  const submitted = Boolean(profile?.submitted_at);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  async function saveProfile(event?: React.FormEvent) {
    event?.preventDefault();
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        state: form.state || null,
        lga: form.lga.trim() || null,
        engineering_field: form.engineering_field || null,
        qualification: form.qualification || null,
        notes: form.notes.trim() || null,
        terms_accepted: form.terms_accepted,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Details saved.");
    void load();
  }

  async function uploadAvatar(file: File) {
    if (!userId) return;
    const path = `${userId}/avatar-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
    toast.success("Profile picture updated.");
    void load();
  }

  async function uploadDocs(files: FileList) {
    if (!userId) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }
      await supabase.from("documents").insert({
        user_id: userId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        content_type: file.type,
      });
    }
    setBusy(false);
    toast.success("Documents uploaded.");
    void load();
  }

  async function openDoc(doc: Doc) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSubmitApplication() {
    setBusy(true);
    try {
      await saveProfile();
      const result = await submitApp({});
      if (!result.submitted) {
        setMissing(result.missing);
        toast.error("Your application is not complete yet.");
        return;
      }
      setMissing([]);
      toast.success("Your application has been received.");
      setView("status");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(note: Note) {
    setOpenNote(note);
    setReply("");
    if (note.read) return;
    await supabase.from("notifications").update({ read: true }).eq("id", note.id);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, read: true } : n)));
  }

  async function sendReply(body: string, clear: () => void) {
    const text = body.trim();
    if (!text) return toast.error("Type a message first.");
    setBusy(true);
    try {
      await sendMsg({ data: { body: text } });
      toast.success("Message sent to the admin.");
      clear();
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf() {
    if (!profile) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("WILLIE LAB TECH — Application Summary", 14, 20);
    doc.setFontSize(11);
    const rows: [string, string][] = [
      ["Full name", profile.full_name],
      ["Email", profile.email],
      ["Phone", profile.phone ?? "-"],
      ["Gender", profile.gender ?? "-"],
      ["Date of birth", profile.date_of_birth ?? "-"],
      ["State", profile.state ?? "-"],
      ["LGA", profile.lga ?? "-"],
      ["Engineering field", profile.engineering_field ?? "-"],
      ["Qualification", profile.qualification ?? "-"],
      ["Application status", profile.status],
      ["Employment status", EMPLOYMENT_LABELS[profile.employment_status] ?? profile.employment_status],
      ["Submitted on", profile.submitted_at ? new Date(profile.submitted_at).toLocaleString() : "Not submitted"],
    ];
    let y = 34;
    rows.forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, y);
      y += 8;
    });
    y += 4;
    doc.text("Skills / notes:", 14, y);
    y += 7;
    doc.text(doc.splitTextToSize(profile.notes ?? "-", 180), 14, y);
    doc.save("willie-lab-tech-application.pdf");
  }

  const applicationForm = (
    <form onSubmit={saveProfile} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
            <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
            <SelectContent>
              {NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lga">Local Government Area</Label>
          <Input id="lga" value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Engineering field</Label>
          <Select value={form.engineering_field} onValueChange={(v) => setForm({ ...form, engineering_field: v })}>
            <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
            <SelectContent>
              {ENGINEERING_FIELD_NAMES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Educational qualification</Label>
          <Select value={form.qualification} onValueChange={(v) => setForm({ ...form, qualification: v })}>
            <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
            <SelectContent>
              {QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes / skills description</Label>
        <Textarea
          id="notes"
          rows={5}
          maxLength={2000}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Describe your skills, experience and what you hope to gain (at least 20 characters)."
        />
      </div>

      <div className="rounded-lg border bg-secondary p-4">
        <p className="text-sm font-semibold text-primary">Documents (ID / CV / certificates)</p>
        <Input
          type="file"
          multiple
          className="mt-2 bg-card"
          onChange={(e) => e.target.files && uploadDocs(e.target.files)}
        />
        <ul className="mt-3 space-y-2">
          {docs.length === 0 ? (
            <li className="text-sm text-muted-foreground">No documents uploaded yet.</li>
          ) : (
            docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{doc.file_name}</span>
                <button type="button" onClick={() => openDoc(doc)} className="shrink-0 font-semibold text-primary underline">
                  View
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={form.terms_accepted}
          onCheckedChange={(v) => setForm({ ...form, terms_accepted: v === true })}
        />
        <span>I confirm the information provided is accurate.</span>
      </label>

      {missing.length > 0 ? (
        <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4">
          <p className="font-semibold text-destructive">Your application is not complete. Please provide:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-destructive">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} variant="outline" className="border-primary text-primary">
          Save progress
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={handleSubmitApplication}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Submit application
        </Button>
      </div>
    </form>
  );

  const steps = ["Submitted", "Under Review", "Decision Made"];
  const stepIndex = !submitted ? -1 : profile?.status === "pending" ? 1 : 2;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalAppHeader
        subtitle="Applicant portal"
        items={MENU}
        active={view}
        unread={unread}
        onSelect={(key) => {
          setOpenNote(null);
          setView(key);
        }}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {view === "home" ? (
          <div className="space-y-8">
            <section className="rounded-xl bg-hero p-6 text-primary-foreground shadow-soft">
              <h1 className="text-2xl font-bold sm:text-3xl">Welcome to Willie Lab Tech Employment Portal</h1>
              <p className="mt-2 text-sm opacity-90">
                Hello {profile?.full_name || "applicant"} — this empowerment connects young Nigerian engineers with
                real opportunities in their field. Complete your application, upload your credentials and track every
                decision right here in your portal.
              </p>
              <div className="mt-5 max-w-sm">
                <DeadlineCountdown tone="dark" />
              </div>
            </section>

            {!submitted ? (
              <section className="rounded-xl border bg-card p-5 shadow-soft">
                <h2 className="text-xl font-bold text-primary">Apply for Employment</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fill in every field, upload your documents and submit.
                </p>
                <div className="mt-5">{applicationForm}</div>
              </section>
            ) : (
              <section className="rounded-xl border-l-4 border-primary bg-secondary p-5">
                <h2 className="text-xl font-bold text-primary">Your application has been received</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submitted on {new Date(profile!.submitted_at!).toLocaleString()}. View it any time from the
                  Application menu.
                </p>
              </section>
            )}

            <section className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="text-xl font-bold text-primary">Purpose of this programme</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Willie Lab Tech exists to bridge the gap between graduation and real engineering practice. The
                programme is recruiting 10,000 engineers across twenty disciplines, matching each applicant with
                placements, mentorship and hands-on projects so their training turns into a career. Applications run
                from 29 July to 10 August 2026 and the initiative is sponsored by Engr. Willie Effiong.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-primary">Engineering fields being recruited</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {ENGINEERING_FIELDS.map((field) => (
                  <article key={field.name} className="overflow-hidden rounded-xl border bg-card shadow-soft">
                    <img src={field.image} alt={field.name} loading="lazy" className="h-24 w-full object-cover sm:h-28" />
                    <div className="p-3">
                      <h3 className="text-sm font-bold text-primary">{field.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{field.blurb}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {view === "profile" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">My profile</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-accent">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {(profile?.full_name ?? "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{profile?.full_name}</p>
                <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-2 max-w-xs"
                  onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                />
              </div>
            </div>
            <div className="mt-6">{applicationForm}</div>
          </section>
        ) : null}

        {view === "application" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">My application</h1>
            {submitted && profile ? (
              <>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Full name", profile.full_name],
                    ["Email", profile.email],
                    ["Phone", profile.phone ?? "-"],
                    ["Gender", profile.gender ?? "-"],
                    ["Date of birth", profile.date_of_birth ?? "-"],
                    ["State", profile.state ?? "-"],
                    ["LGA", profile.lga ?? "-"],
                    ["Engineering field", profile.engineering_field ?? "-"],
                    ["Qualification", profile.qualification ?? "-"],
                    ["Submitted", new Date(profile.submitted_at!).toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg bg-secondary p-3">
                      <dt className="text-xs font-semibold text-muted-foreground uppercase">{k}</dt>
                      <dd className="text-sm font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 rounded-lg bg-secondary p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Skills / notes</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{profile.notes}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-primary">Documents</p>
                  <ul className="mt-2 space-y-2">
                    {docs.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{doc.file_name}</span>
                        <button type="button" onClick={() => openDoc(doc)} className="shrink-0 font-semibold text-primary underline">
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button onClick={downloadPdf} className="mt-5 bg-accent text-accent-foreground hover:bg-accent/90">
                  Download PDF summary
                </Button>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  You have not applied yet. Complete the form below to submit your application.
                </p>
                <div className="mt-5">{applicationForm}</div>
              </>
            )}
          </section>
        ) : null}

        {view === "status" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">Application status</h1>
            {submitted ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Decision:</span>
                  <StatusBadge status={profile!.status} />
                </div>
                <ol className="mt-6 space-y-3">
                  {steps.map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                          index <= stepIndex
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className={index <= stepIndex ? "font-semibold text-primary" : "text-muted-foreground"}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
                {profile?.review_reason ? (
                  <div className="mt-5 rounded-lg border-l-4 border-accent bg-secondary p-4">
                    <p className="text-sm font-semibold text-primary">Feedback from the admin</p>
                    <p className="mt-1 text-sm">{profile.review_reason}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                You have not submitted your application yet. Go to Application in the menu to complete it.
              </p>
            )}
          </section>
        ) : null}

        {view === "employment" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">Employment status</h1>
            <div className="mt-4 rounded-lg bg-secondary p-5">
              <p className="text-3xl font-bold text-primary">
                {EMPLOYMENT_LABELS[profile?.employment_status ?? "pending"]}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {profile?.employment_status === "employed"
                  ? "Congratulations — the admin has offered you employment through this empowerment."
                  : profile?.employment_status === "not_qualified"
                    ? "You were not qualified for employment at this time. You can still message the admin from Feedback / Chat."
                    : "No employment decision has been made yet. You will be notified as soon as it is."}
              </p>
            </div>
          </section>
        ) : null}

        {view === "feedback" ? (
          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-primary">Feedback / Chat</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send a message or request to the admin at any time.
            </p>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-lg bg-secondary p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.sender === "admin"
                        ? "bg-card"
                        : "ml-auto bg-primary text-primary-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-[11px] opacity-70">
                      {m.sender === "admin" ? "Admin" : "You"} · {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2">
              <Textarea rows={3} maxLength={2000} value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Write your message..." />
              <Button
                disabled={busy}
                onClick={() => sendReply(chat, () => setChat(""))}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Send
              </Button>
            </div>
          </section>
        ) : null}

        {view === "notifications" ? (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Notifications</h1>

            {openNote ? (
              <div className="rounded-xl border bg-card p-5 shadow-soft">
                <button type="button" onClick={() => setOpenNote(null)} className="text-sm font-semibold text-primary underline">
                  ← Back to all notifications
                </button>
                <h2 className="mt-3 text-lg font-bold text-primary">{openNote.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(openNote.created_at).toLocaleString()}</p>
                <p className="mt-3 text-sm whitespace-pre-wrap">{openNote.message}</p>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="reply">Reply to the admin</Label>
                  <Textarea id="reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <Button
                    disabled={busy}
                    onClick={() => sendReply(reply, () => setReply(""))}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Send
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="font-semibold text-primary">Unread ({unread})</h2>
                  <ul className="mt-2 space-y-2">
                    {notes.filter((n) => !n.read).length === 0 ? (
                      <li className="text-sm text-muted-foreground">No unread notifications.</li>
                    ) : (
                      notes.filter((n) => !n.read).map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => markRead(n)}
                            className="w-full rounded-lg border-l-4 border-accent bg-card p-4 text-left shadow-soft"
                          >
                            <p className="font-semibold text-primary">{n.title}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
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
                    {notes.filter((n) => n.read).length === 0 ? (
                      <li className="text-sm text-muted-foreground">Nothing here yet.</li>
                    ) : (
                      notes.filter((n) => n.read).map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => markRead(n)}
                            className="w-full rounded-lg border bg-secondary p-4 text-left"
                          >
                            <p className="font-semibold">{n.title}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </section>
        ) : null}

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Need help?{" "}
          <Link to="/help" className="font-semibold text-primary underline">
            Contact / Help
          </Link>
        </p>
      </main>
      <PortalFooter />
    </div>
  );
}
