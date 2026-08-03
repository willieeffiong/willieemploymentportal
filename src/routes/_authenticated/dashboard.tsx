import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Pencil, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  submitApplicationFn,
  sendMessageToAdmin,
  verifyUploadedDocument,
  updatePassword,
  updateSecurityQuestion,
  fetchApplicationPeriod,
  assistantAsk,
  assistantThreads,
  assistantThreadMessages,
} from "@/lib/portal.functions";
import { PortalAppHeader, PortalFooter } from "@/components/PortalChrome";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import {
  ENGINEERING_FIELDS,
  ENGINEERING_FIELD_NAMES,
  EMPLOYMENT_LABELS,
  EXPERIENCE_LEVELS,
  MAX_WORDS,
  MIN_WORDS,
  NIGERIAN_STATES,
  QUALIFICATIONS,
  SECURITY_QUESTIONS,
  countWords,
  lgasForState,
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
  component: Dashboard,
});

const MENU = [
  { key: "home", label: "Home" },
  { key: "profile", label: "Profile" },
  { key: "application", label: "Application" },
  { key: "status", label: "Application Status" },
  { key: "employment", label: "Employment Status" },
  { key: "feedback", label: "Feedback / Chat" },
  { key: "assistant", label: "Research Assistant" },
  { key: "notifications", label: "Notifications" },
  { key: "settings", label: "Settings" },
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
  years_experience: string | null;
  experience_notes: string | null;
  security_question: string | null;
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
  category: string;
  verification_note: string | null;
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

interface ChatTurn {
  id: string;
  role: string;
  content: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    accepted: "bg-primary text-primary-foreground",
    rejected: "bg-destructive text-destructive-foreground",
    pending: "bg-accent text-accent-foreground",
  };
  return <Badge className={map[status] ?? map.pending}>{status.toUpperCase()}</Badge>;
}

function WordCounter({ value }: { value: string }) {
  const words = countWords(value);
  const ok = words >= MIN_WORDS && words <= MAX_WORDS;
  return (
    <p className={`text-xs font-semibold ${ok ? "text-primary" : "text-destructive"}`}>
      {words}/{MIN_WORDS} words {words > MAX_WORDS ? `— maximum ${MAX_WORDS} words` : ""}
    </p>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const view = search.v ?? "home";

  const submitApp = useServerFn(submitApplicationFn);
  const sendMsg = useServerFn(sendMessageToAdmin);
  const verifyDoc = useServerFn(verifyUploadedDocument);
  const changePwd = useServerFn(updatePassword);
  const changeQuestion = useServerFn(updateSecurityQuestion);
  const loadPeriod = useServerFn(fetchApplicationPeriod);
  const ask = useServerFn(assistantAsk);
  const listThreads = useServerFn(assistantThreads);
  const loadThread = useServerFn(assistantThreadMessages);

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
  const [dirty, setDirty] = useState(false);
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [applicationsOpen, setApplicationsOpen] = useState(true);
  const [docCategory, setDocCategory] = useState("qualification");
  const [docKind, setDocKind] = useState<"pdf" | "image">("pdf");

  // Settings
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");

  // Assistant
  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [assistantInput, setAssistantInput] = useState("");

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
    years_experience: "",
    experience_notes: "",
    terms_accepted: false,
  });

  function setView(key: string) {
    setOpenNote(null);
    navigate({ to: "/dashboard", search: { v: key } });
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

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
        years_experience: prof.years_experience ?? "",
        experience_notes: prof.experience_notes ?? "",
        terms_accepted: prof.terms_accepted ?? false,
      });
      setDirty(false);
      if (prof.security_question) setQuestion(prof.security_question);
      if (prof.avatar_url) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(prof.avatar_url, 3600);
        setAvatarSrc(signed?.signedUrl ?? null);
      } else {
        setAvatarSrc(null);
      }
    }
    setDocs((d ?? []) as unknown as Doc[]);
    setNotes((n ?? []) as Note[]);
    setMessages((m ?? []) as unknown as Msg[]);
  }, []);

  useEffect(() => {
    void load();
    void loadPeriod().then((p) => setApplicationsOpen(p.open));
  }, [load, loadPeriod]);

  useEffect(() => {
    if (view !== "assistant") return;
    void listThreads().then((t) => setThreads(t as { id: string; title: string }[]));
  }, [view, listThreads]);

  const unread = useMemo(() => notes.filter((n) => !n.read).length, [notes]);
  const submitted = Boolean(profile?.submitted_at);
  const locked = submitted;

  function fieldLocked(key: string) {
    return locked && !unlocked[key];
  }

  function unlock(key: string) {
    setUnlocked((prev) => ({ ...prev, [key]: true }));
  }

  function EditLock({ field }: { field: string }) {
    if (!locked) return null;
    return unlocked[field] ? (
      <span className="text-[11px] font-semibold text-accent">unlocked</span>
    ) : (
      <button
        type="button"
        onClick={() => unlock(field)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    );
  }

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
        lga: form.lga || null,
        engineering_field: form.engineering_field || null,
        qualification: form.qualification || null,
        notes: form.notes.trim() || null,
        years_experience: form.years_experience || null,
        experience_notes: form.experience_notes.trim() || null,
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
      const { data: inserted, error: insertError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          content_type: file.type,
          category: docCategory,
          verification_status: "pending",
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        toast.error(`${file.name}: ${insertError?.message ?? "Could not save the document."}`);
        continue;
      }

      toast.info(`Checking ${file.name}...`);
      try {
        const result = await verifyDoc({ data: { documentId: inserted.id } });
        if (result.status === "rejected") {
          toast.error(`${file.name} was rejected: ${result.note}`);
        } else {
          toast.success(`${file.name} accepted.`);
        }
      } catch {
        toast.warning(`${file.name} uploaded — automatic review was unavailable.`);
      }
      setDirty(true);
    }
    setBusy(false);
    void load();
  }

  async function openDoc(doc: Doc) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDoc(doc: Doc) {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDirty(true);
    toast.success("Document removed.");
    void load();
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
      setDirty(false);
      setUnlocked({});
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
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your security question.");
    } finally {
      setBusy(false);
    }
  }

  async function sendToAssistant() {
    const text = assistantInput.trim();
    if (!text) return;
    setAssistantInput("");
    setTurns((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text }]);
    setBusy(true);
    try {
      const result = await ask({ data: { threadId, message: text } });
      setThreadId(result.threadId);
      setTurns((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: result.reply }]);
      void listThreads().then((t) => setThreads(t as { id: string; title: string }[]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  }

  async function openThread(id: string) {
    setThreadId(id);
    const rows = await loadThread({ data: { threadId: id } });
    setTurns(rows as ChatTurn[]);
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
      ["Years of experience", profile.years_experience ?? "-"],
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
    doc.text("Skills:", 14, y);
    y += 7;
    const skills = doc.splitTextToSize(profile.notes ?? "-", 180) as string[];
    doc.text(skills, 14, y);
    y += skills.length * 6 + 6;
    doc.text("Experience:", 14, y);
    y += 7;
    doc.text(doc.splitTextToSize(profile.experience_notes ?? "-", 180) as string[], 14, y);
    doc.save("willie-lab-tech-application.pdf");
  }

  const lgaOptions = lgasForState(form.state);

  const applicationForm = (
    <form onSubmit={saveProfile} className="space-y-4">
      {locked ? (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-accent bg-secondary p-3 text-sm">
          <Lock className="h-4 w-4 text-primary" />
          <span>
            Your application is submitted and locked. Tap <strong>Edit</strong> beside any field you need to change.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="full_name">Full name (first, middle, surname)</Label>
            <EditLock field="full_name" />
          </div>
          <Input
            id="full_name"
            value={form.full_name}
            disabled={fieldLocked("full_name")}
            onChange={(e) => update("full_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="phone">Phone number</Label>
            <EditLock field="phone" />
          </div>
          <Input
            id="phone"
            value={form.phone}
            disabled={fieldLocked("phone")}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Gender</Label>
            <EditLock field="gender" />
          </div>
          <Select value={form.gender} onValueChange={(v) => update("gender", v)} disabled={fieldLocked("gender")}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="dob">Date of birth</Label>
            <EditLock field="dob" />
          </div>
          <Input
            id="dob"
            type="date"
            value={form.date_of_birth}
            disabled={fieldLocked("dob")}
            onChange={(e) => update("date_of_birth", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>State</Label>
            <EditLock field="state" />
          </div>
          <Select
            value={form.state}
            onValueChange={(v) => {
              update("state", v);
              update("lga", "");
            }}
            disabled={fieldLocked("state")}
          >
            <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Local Government Area</Label>
            <EditLock field="lga" />
          </div>
          <Select
            value={form.lga}
            onValueChange={(v) => update("lga", v)}
            disabled={fieldLocked("lga") || !form.state}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.state ? "Select LGA" : "Select a state first"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {lgaOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Engineering field</Label>
            <EditLock field="engineering_field" />
          </div>
          <Select
            value={form.engineering_field}
            onValueChange={(v) => update("engineering_field", v)}
            disabled={fieldLocked("engineering_field")}
          >
            <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {ENGINEERING_FIELD_NAMES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Educational qualification</Label>
            <EditLock field="qualification" />
          </div>
          <Select
            value={form.qualification}
            onValueChange={(v) => update("qualification", v)}
            disabled={fieldLocked("qualification")}
          >
            <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
            <SelectContent>
              {QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Years of experience</Label>
            <EditLock field="years_experience" />
          </div>
          <Select
            value={form.years_experience}
            onValueChange={(v) => update("years_experience", v)}
            disabled={fieldLocked("years_experience")}
          >
            <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="notes">Skills description</Label>
          <EditLock field="notes" />
        </div>
        <Textarea
          id="notes"
          rows={5}
          value={form.notes}
          disabled={fieldLocked("notes")}
          onChange={(e) => update("notes", e.target.value)}
          placeholder={`Describe your engineering skills in at least ${MIN_WORDS} words (maximum ${MAX_WORDS}).`}
        />
        <WordCounter value={form.notes} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="experience_notes">Experience description</Label>
          <EditLock field="experience_notes" />
        </div>
        <Textarea
          id="experience_notes"
          rows={5}
          value={form.experience_notes}
          disabled={fieldLocked("experience_notes")}
          onChange={(e) => update("experience_notes", e.target.value)}
          placeholder={`Describe the work or projects you have done, in at least ${MIN_WORDS} words (maximum ${MAX_WORDS}).`}
        />
        <WordCounter value={form.experience_notes} />
      </div>

      <div className="rounded-lg border bg-secondary p-4">
        <p className="text-sm font-semibold text-primary">Documents</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Qualification documents (ID, certificate, CV) are required. Skills evidence is optional. Every upload is
          checked automatically — blurry or unrelated files are rejected.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Document type</Label>
            <Select value={docCategory} onValueChange={setDocCategory}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualification">Qualification (required)</SelectItem>
                <SelectItem value="skill">Skills evidence (optional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">File format</Label>
            <Select value={docKind} onValueChange={(v) => setDocKind(v as "pdf" | "image")}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="image">Image (JPEG / PNG)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Input
          type="file"
          multiple
          accept={docKind === "pdf" ? "application/pdf" : "image/jpeg,image/png"}
          className="mt-3 bg-card"
          disabled={busy}
          onChange={(e) => e.target.files && uploadDocs(e.target.files)}
        />

        <ul className="mt-3 space-y-2">
          {docs.length === 0 ? (
            <li className="text-sm text-muted-foreground">No documents uploaded yet.</li>
          ) : (
            docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{doc.file_name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {doc.category === "skill" ? "Skills evidence" : "Qualification"}
                  </span>
                </span>
                <span className="flex shrink-0 gap-3">
                  <button type="button" onClick={() => openDoc(doc)} className="font-semibold text-primary underline">
                    View
                  </button>
                  <button type="button" onClick={() => deleteDoc(doc)} className="font-semibold text-destructive underline">
                    Remove
                  </button>
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={form.terms_accepted}
          onCheckedChange={(v) => update("terms_accepted", v === true)}
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

      {!applicationsOpen ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          The application period is closed, so new applications can no longer be submitted.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} variant="outline" className="border-primary text-primary">
          Save progress
        </Button>
        <Button
          type="button"
          disabled={busy || (submitted && !dirty) || !applicationsOpen}
          onClick={handleSubmitApplication}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {submitted ? (dirty ? "Resubmit changes" : "Submitted") : "Submit application"}
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
        onSelect={setView}
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
                placements, mentorship and hands-on projects so their training turns into a career. The initiative is
                sponsored by Engr. Willie Effiong.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-primary">Engineering fields being recruited</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {ENGINEERING_FIELDS.map((field) => (
                  <article key={field.name} className="overflow-hidden rounded-xl border bg-card shadow-soft">
                    <img
                      src={field.image}
                      alt={`${field.name} — Nigerian engineer at work`}
                      loading="lazy"
                      width={800}
                      height={600}
                      className="h-24 w-full object-cover sm:h-28"
                    />
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
            <div className="mt-5">{applicationForm}</div>
            {submitted ? (
              <Button onClick={downloadPdf} className="mt-5 bg-accent text-accent-foreground hover:bg-accent/90">
                Download PDF summary
              </Button>
            ) : null}
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
                      m.sender === "admin" ? "bg-card" : "ml-auto bg-primary text-primary-foreground"
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

        {view === "assistant" ? <AssistantChat /> : null}


        {view === "settings" ? (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Settings</h1>

            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="font-bold text-primary">Change password</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="np">New password</Label>
                  <Input id="np" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp">Confirm new password</Label>
                  <Input id="cp" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <Button disabled={busy} onClick={savePassword} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                Update password
              </Button>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="font-bold text-primary">Security question</h2>
              <p className="mt-1 text-sm text-muted-foreground">Used to recover your password.</p>
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

            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <h2 className="font-bold text-primary">Profile information</h2>
              <p className="mt-1 text-sm text-muted-foreground">Update your details from the Profile menu.</p>
              <Button variant="outline" className="mt-3 border-primary text-primary" onClick={() => setView("profile")}>
                Go to profile
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
