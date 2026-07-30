import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ADMIN_EMAIL, ADMIN_PASSWORD, normalizeEmail } from "./portal.server";
import { sendMail } from "./email.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
}

async function adminUserId(): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("id").eq("email", ADMIN_EMAIL).maybeSingle();
  return data?.id ?? null;
}

async function notifyAdmin(title: string, message: string) {
  const id = await adminUserId();
  if (!id) return;
  await supabaseAdmin.from("notifications").insert({ user_id: id, title, message });
}

export async function register(input: { fullName: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (error || !created.user) {
    const message = error?.message ?? "Could not create the account";
    if (/already/i.test(message)) throw new Error("An account with this email already exists.");
    throw new Error(message);
  }

  const userId = created.user.id;
  await supabaseAdmin
    .from("profiles")
    .insert({ id: userId, full_name: input.fullName, email, email_verified: true });
  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "applicant" });

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title: "Welcome to Willie Lab Tech",
    message:
      "Your account has been created. Complete your profile, upload your documents and submit your application.",
  });

  await notifyAdmin("New applicant registered", `${input.fullName} (${email}) created an account on the portal.`);

  await sendMail({
    to: ADMIN_EMAIL,
    subject: "New applicant registered",
    title: "New applicant registration",
    bodyHtml: `<p>A new applicant has registered on the portal.</p><p><strong>Name:</strong> ${input.fullName}<br/><strong>Email:</strong> ${email}</p>`,
    text: `New applicant: ${input.fullName} (${email}).`,
    idempotencyKey: `new-applicant-${userId}`,
  });

  return { created: true };
}

export async function ensureAdmin() {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();

  let adminId = existing?.id;

  if (!adminId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Engr. Willie Effiong" },
    });
    if (error || !created.user) return { ready: false };
    adminId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .insert({ id: adminId, full_name: "Engr. Willie Effiong", email: ADMIN_EMAIL, email_verified: true });
  }

  await supabaseAdmin.from("user_roles").upsert({ user_id: adminId, role: "admin" }, { onConflict: "user_id,role" });
  return { ready: true };
}

export async function adminListApplicants(adminId: string) {
  await assertAdmin(adminId);
  const { data: adminIds } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  const excluded = (adminIds ?? []).map((r) => r.user_id);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, status, employment_status, engineering_field, qualification, state, created_at, submitted_at, reviewed_at",
    )
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);

  const applicants = (data ?? []).filter((p) => !excluded.includes(p.id));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const decided = applicants.filter((a) => a.status !== "pending").length;
  const accepted = applicants.filter((a) => a.status === "accepted").length;

  return {
    applicants,
    totals: {
      total: applicants.length,
      pending: applicants.filter((a) => a.status === "pending").length,
      accepted,
      rejected: applicants.filter((a) => a.status === "rejected").length,
      thisWeek: applicants.filter((a) => a.submitted_at && new Date(a.submitted_at).getTime() > weekAgo).length,
      acceptanceRate: decided ? Math.round((accepted / decided) * 100) : 0,
      employed: applicants.filter((a) => a.employment_status === "employed").length,
    },
  };
}

export async function adminGetApplicant(adminId: string, applicantId: string) {
  await assertAdmin(adminId);
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Applicant not found");

  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("user_id", applicantId)
    .order("created_at", { ascending: false });

  const documents = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 60 * 60);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );

  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(profile.avatar_url, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("user_id", applicantId)
    .order("created_at", { ascending: true });

  return { profile, documents, avatarUrl, messages: messages ?? [] };
}

async function applyDecision(applicantId: string, decision: "accepted" | "rejected", reason?: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, status")
    .eq("id", applicantId)
    .maybeSingle();
  if (!profile) throw new Error("Applicant not found");
  if (profile.status !== "pending") throw new Error(`This application was already ${profile.status}.`);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      status: decision,
      review_reason: reason ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicantId);
  if (error) throw new Error(error.message);

  const accepted = decision === "accepted";
  await supabaseAdmin.from("notifications").insert({
    user_id: applicantId,
    title: accepted ? "Your application has been accepted" : "Your application has been rejected",
    message: accepted
      ? `Congratulations ${profile.full_name}. Your application to the Willie Lab Tech empowerment has been accepted.${reason ? ` Note from the admin: ${reason}` : ""}`
      : `Your application was not successful at this time.${reason ? ` Reason: ${reason}` : ""}`,
  });

  await sendMail({
    to: profile.email,
    subject: "Update on your Willie Lab Tech application",
    title: "You have a portal update",
    bodyHtml:
      "<p>There is an update on your Willie Lab Tech empowerment application.</p><p>Please log in to the portal and check your dashboard to see the update.</p>",
    text: "There is an update on your Willie Lab Tech application. Log in to the portal to check your dashboard.",
    idempotencyKey: `review-${applicantId}-${Date.now()}`,
  });
}

export async function adminReview(
  adminId: string,
  input: { applicantId: string; decision: "accepted" | "rejected"; reason?: string },
) {
  await assertAdmin(adminId);
  await applyDecision(input.applicantId, input.decision, input.reason);
  return { ok: true };
}

export async function adminBulkReview(
  adminId: string,
  input: { applicantIds: string[]; decision: "accepted" | "rejected"; reason?: string },
) {
  await assertAdmin(adminId);
  let done = 0;
  const failed: string[] = [];
  for (const id of input.applicantIds) {
    try {
      await applyDecision(id, input.decision, input.reason);
      done += 1;
    } catch {
      failed.push(id);
    }
  }
  return { done, failed: failed.length };
}

export async function adminSetEmployment(
  adminId: string,
  input: { applicantId: string; employmentStatus: "pending" | "employed" | "not_qualified"; note?: string },
) {
  await assertAdmin(adminId);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ employment_status: input.employmentStatus })
    .eq("id", input.applicantId);
  if (error) throw new Error(error.message);

  const labels: Record<string, string> = {
    pending: "Your employment decision is still pending.",
    employed: "Congratulations — you have been offered employment through Willie Lab Tech.",
    not_qualified: "You were not qualified for employment at this time.",
  };

  await supabaseAdmin.from("notifications").insert({
    user_id: input.applicantId,
    title: "Employment status updated",
    message: `${labels[input.employmentStatus]}${input.note ? ` ${input.note}` : ""}`,
  });

  return { ok: true };
}

export async function adminSendMessage(adminId: string, input: { applicantId: string; body: string }) {
  await assertAdmin(adminId);
  await supabaseAdmin.from("messages").insert({
    user_id: input.applicantId,
    sender: "admin",
    body: input.body,
    read_by_admin: true,
  });
  await supabaseAdmin.from("notifications").insert({
    user_id: input.applicantId,
    title: "Admin sent you a message",
    message: input.body,
  });
  return { ok: true };
}

export async function adminInbox(adminId: string) {
  await assertAdmin(adminId);
  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("sender", "applicant")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = Array.from(new Set((messages ?? []).map((m) => m.user_id)));
  const { data: profiles } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as { id: string; full_name: string; email: string }[] };

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    messages: (messages ?? []).map((m) => ({
      ...m,
      full_name: byId.get(m.user_id)?.full_name ?? "Applicant",
      email: byId.get(m.user_id)?.email ?? "",
    })),
    unread: (messages ?? []).filter((m) => !m.read_by_admin).length,
  };
}

export async function adminMarkInboxRead(adminId: string) {
  await assertAdmin(adminId);
  await supabaseAdmin.from("messages").update({ read_by_admin: true }).eq("sender", "applicant").eq("read_by_admin", false);
  return { ok: true };
}

export async function sendUserMessage(userId: string, body: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  await supabaseAdmin.from("messages").insert({ user_id: userId, sender: "applicant", body, read_by_user: true });
  await notifyAdmin(
    "New message from an applicant",
    `${profile?.full_name ?? "An applicant"} (${profile?.email ?? ""}): ${body}`,
  );
  return { ok: true };
}

export async function submitApplication(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) throw new Error("Profile not found");

  const { count } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const missing: string[] = [];
  if (!profile.full_name?.trim()) missing.push("Full name");
  if (!profile.gender) missing.push("Gender");
  if (!profile.date_of_birth) missing.push("Date of birth");
  if (!profile.phone?.trim()) missing.push("Phone number");
  if (!profile.state) missing.push("State");
  if (!profile.lga?.trim()) missing.push("Local Government Area");
  if (!profile.engineering_field) missing.push("Engineering field");
  if (!profile.qualification) missing.push("Educational qualification");
  if (!profile.notes || profile.notes.trim().length < 20) missing.push("Notes / skills description (at least 20 characters)");
  if (!profile.terms_accepted) missing.push("Confirmation that your information is accurate");
  if (!count) missing.push("At least one document (ID / CV / certificate)");

  if (missing.length) return { submitted: false, missing };
  if (profile.submitted_at) return { submitted: true, missing: [] as string[] };

  const submittedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("profiles").update({ submitted_at: submittedAt }).eq("id", userId);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title: "Your application has been received",
    message: "Your application has been submitted successfully and is now pending review by the admin.",
  });

  await notifyAdmin(
    "New application submitted",
    `${profile.full_name} (${profile.email}) submitted a complete application for review.`,
  );

  await sendMail({
    to: ADMIN_EMAIL,
    subject: "New application submitted",
    title: "New application submitted",
    bodyHtml: `<p>An applicant has submitted a complete application.</p><p><strong>Name:</strong> ${profile.full_name}<br/><strong>Email:</strong> ${profile.email}</p>`,
    text: `New application submitted by ${profile.full_name} (${profile.email}).`,
    idempotencyKey: `submitted-${userId}`,
  });

  return { submitted: true, missing: [] as string[] };
}
