import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PortalFooter, PortalHeader } from "@/components/PortalChrome";
import { NIGERIAN_STATES, QUALIFICATIONS } from "@/lib/portal-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const title = "Applicant Dashboard — WILLIE LAB TECH";
const description = "Track your application status, complete your profile and upload your documents.";

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
  component: DashboardPage,
});

const statusStyles: Record<string, string> = {
  pending: "bg-accent text-accent-foreground",
  accepted: "bg-primary text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    gender: "",
    date_of_birth: "",
    state: "",
    lga: "",
    qualification: "",
    notes: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["documents", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (!profile) return;
    setForm({
      gender: profile.gender ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      state: profile.state ?? "",
      lga: profile.lga ?? "",
      qualification: profile.qualification ?? "",
      notes: profile.notes ?? "",
    });
  }, [profile]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        state: form.state || null,
        lga: form.lga || null,
        qualification: form.qualification || null,
        notes: form.notes || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error("Could not save your profile.");
    toast.success("Profile saved.");
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  }

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !userId) return;
    setUploading(true);
    for (const file of files) {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        toast.error(`Could not upload ${file.name}`);
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
    setUploading(false);
    event.target.value = "";
    toast.success("Upload complete.");
    queryClient.invalidateQueries({ queryKey: ["documents", userId] });
  }

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 300);
    if (error || !data) return toast.error("Could not open this document.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const status = profile?.status ?? "pending";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalHeader subtitle="Dashboard" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <section className="rounded-xl bg-hero p-5 text-primary-foreground shadow-soft">
          <h1 className="text-2xl font-bold sm:text-3xl">Welcome, {profile?.full_name || "Applicant"}</h1>
          <p className="mt-1 text-sm opacity-90">Willie Lab Tech empowerment application</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm">Application status:</span>
            <span className={`rounded-full px-4 py-1 text-sm font-bold uppercase ${statusStyles[status]}`}>
              {status}
            </span>
            <Button variant="outline" size="sm" className="ml-auto border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={signOut}>
              Logout
            </Button>
          </div>
          {profile?.review_reason ? (
            <p className="mt-3 rounded-md bg-primary-foreground/10 p-3 text-sm">
              Admin feedback: {profile.review_reason}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="text-xl font-bold text-primary">Notifications</h2>
          <div className="mt-3 space-y-3">
            {(notificationsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              (notificationsQuery.data ?? []).map((n) => (
                <div key={n.id} className="rounded-md border-l-4 border-accent bg-secondary p-3">
                  <p className="font-semibold text-secondary-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="text-xl font-bold text-primary">My profile</h2>
          <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <select
                id="state"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lga">Local Government Area</Label>
              <Input
                id="lga"
                maxLength={100}
                value={form.lga}
                onChange={(e) => setForm({ ...form, lga: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="qualification">Educational Qualification</Label>
              <select
                id="qualification"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              >
                <option value="">Select qualification</option>
                {QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes / Skills</Label>
              <Textarea
                id="notes"
                rows={5}
                maxLength={2000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Describe your field, skills and experience"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {saving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="text-xl font-bold text-primary">My documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your CV, certificates and any supporting documents.
          </p>
          <Input type="file" multiple className="mt-3" onChange={uploadFiles} disabled={uploading} />
          <ul className="mt-4 space-y-2">
            {(documentsQuery.data ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">No documents uploaded yet.</li>
            ) : (
              (documentsQuery.data ?? []).map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-secondary px-3 py-2"
                >
                  <span className="truncate text-sm">{doc.file_name}</span>
                  <Button size="sm" variant="outline" onClick={() => openDocument(doc.file_path)}>
                    View
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}
