import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ADMIN_EMAIL, ADMIN_PASSWORD, generateOtp, normalizeEmail, otpExpiry } from "./portal.server";
import { otpEmail, sendMail } from "./email.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
}

async function issueCode(userId: string, email: string) {
  const code = generateOtp();
  await supabaseAdmin.from("verification_codes").update({ used: true }).eq("user_id", userId).eq("used", false);
  await supabaseAdmin.from("verification_codes").insert({ user_id: userId, code, expires_at: otpExpiry() });
  const mail = await sendMail({ to: email, ...otpEmail(code) });
  return { code, emailSent: mail.sent };
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
  await supabaseAdmin.from("profiles").insert({ id: userId, full_name: input.fullName, email });
  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "applicant" });

  const { code, emailSent } = await issueCode(userId, email);

  await sendMail({
    to: ADMIN_EMAIL,
    subject: "New applicant registered",
    title: "New applicant registration",
    bodyHtml: `<p>A new applicant has registered on the portal.</p><p><strong>Name:</strong> ${input.fullName}<br/><strong>Email:</strong> ${email}</p><p>Log in to the admin dashboard to review the application.</p>`,
    text: `New applicant: ${input.fullName} (${email}). Log in to the admin dashboard to review.`,
    idempotencyKey: `new-applicant-${userId}`,
  });

  return { emailSent, fallbackCode: emailSent ? null : code };
}

export async function verify(input: { email: string; code: string }) {
  const email = normalizeEmail(input.email);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email_verified")
    .eq("email", email)
    .maybeSingle();

  if (!profile) throw new Error("No account found for this email.");
  if (profile.email_verified) return { verified: true };

  const { data: row } = await supabaseAdmin
    .from("verification_codes")
    .select("id, expires_at")
    .eq("user_id", profile.id)
    .eq("code", input.code)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) throw new Error("That code is not correct.");
  if (new Date(row.expires_at) < new Date()) throw new Error("That code has expired. Request a new one.");

  await supabaseAdmin.from("verification_codes").update({ used: true }).eq("id", row.id);
  await supabaseAdmin.from("profiles").update({ email_verified: true }).eq("id", profile.id);
  await supabaseAdmin.from("notifications").insert({
    user_id: profile.id,
    title: "Welcome to Willie Lab Tech",
    message: "Your account has been created. Complete your profile and upload your documents to finish your application.",
  });

  return { verified: true };
}

export async function resend(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email_verified")
    .eq("email", email)
    .maybeSingle();
  if (!profile) throw new Error("No account found for this email.");
  if (profile.email_verified) return { emailSent: true, fallbackCode: null };
  const { code, emailSent } = await issueCode(profile.id, email);
  return { emailSent, fallbackCode: emailSent ? null : code };
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
    .select("id, full_name, email, status, created_at, email_verified, state, qualification, submitted_at")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);

  const applicants = (data ?? []).filter((p) => !excluded.includes(p.id));
  return {
    applicants,
    totals: {
      total: applicants.length,
      pending: applicants.filter((a) => a.status === "pending").length,
      accepted: applicants.filter((a) => a.status === "accepted").length,
      rejected: applicants.filter((a) => a.status === "rejected").length,
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

  return { profile, documents };
}

export async function adminReview(
  adminId: string,
  input: { applicantId: string; decision: "accepted" | "rejected"; reason?: string },
) {
  await assertAdmin(adminId);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", input.applicantId)
    .maybeSingle();
  if (!profile) throw new Error("Applicant not found");

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      status: input.decision,
      review_reason: input.reason ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.applicantId);
  if (error) throw new Error(error.message);

  const accepted = input.decision === "accepted";
  await supabaseAdmin.from("notifications").insert({
    user_id: input.applicantId,
    title: accepted ? "Application accepted" : "Application rejected",
    message: accepted
      ? `Congratulations ${profile.full_name}. Your application to the Willie Lab Tech empowerment has been accepted.${input.reason ? ` Note from the admin: ${input.reason}` : ""}`
      : `Your application was not successful at this time.${input.reason ? ` Reason: ${input.reason}` : ""}`,
  });

  const mail = await sendMail({
    to: profile.email,
    subject: "Update on your Willie Lab Tech application",
    title: "You have a portal update",
    bodyHtml:
      "<p>There is an update on your Willie Lab Tech empowerment application.</p><p>Please log in to the portal and check your dashboard to see the update.</p>",
    text: "There is an update on your Willie Lab Tech application. Log in to the portal to check your dashboard.",
    idempotencyKey: `review-${input.applicantId}-${Date.now()}`,
  });

  return { ok: true, emailSent: mail.sent };
}
