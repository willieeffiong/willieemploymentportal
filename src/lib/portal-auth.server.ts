import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ADMIN_EMAIL,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES,
  hashSecurityAnswer,
  normalizeEmail,
  verifySecurityAnswer,
} from "./portal.server";

/** The admin address may only be used on the Admin login screen. */
export function assertApplicantEmail(rawEmail: string) {
  if (normalizeEmail(rawEmail) === normalizeEmail(ADMIN_EMAIL)) {
    throw new Error("This email belongs to the administrator. Please use the Admin login instead.");
  }
  return { ok: true };
}


/** Throws when the account is temporarily locked after too many failed attempts. */
export async function assertNotLocked(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const { data } = await supabaseAdmin
    .from("login_attempts")
    .select("failed_count, locked_until")
    .eq("email", email)
    .maybeSingle();

  if (data?.locked_until && new Date(data.locked_until).getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 60000));
    throw new Error(`Too many failed login attempts. Please try again in ${minutes} minute(s).`);
  }
  return { ok: true };
}

export async function recordLoginResult(rawEmail: string, success: boolean) {
  const email = normalizeEmail(rawEmail);

  if (success) {
    await supabaseAdmin.from("login_attempts").delete().eq("email", email);
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  const { data } = await supabaseAdmin
    .from("login_attempts")
    .select("failed_count")
    .eq("email", email)
    .maybeSingle();

  const failed = (data?.failed_count ?? 0) + 1;
  const locked = failed >= MAX_LOGIN_ATTEMPTS;

  await supabaseAdmin.from("login_attempts").upsert(
    {
      email,
      failed_count: locked ? 0 : failed,
      locked_until: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  return { locked, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - failed) };
}

export async function getSecurityQuestion(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, security_question, security_answer_hash")
    .eq("email", email)
    .maybeSingle();

  if (!data?.security_question || !data.security_answer_hash) {
    throw new Error("No security question is set for this email. Please contact the admin for help.");
  }
  return { question: data.security_question };
}

export async function resetPasswordWithAnswer(input: {
  email: string;
  answer: string;
  newPassword: string;
}) {
  const email = normalizeEmail(input.email);
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, security_answer_hash")
    .eq("email", email)
    .maybeSingle();

  if (!data) throw new Error("No account found for this email.");
  const ok = await verifySecurityAnswer(input.answer, data.security_answer_hash);
  if (!ok) throw new Error("That answer is not correct.");

  const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
    password: input.newPassword,
  });
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("login_attempts").delete().eq("email", email);
  return { ok: true };
}

export async function saveSecurityQuestion(userId: string, question: string, answer: string) {
  const hash = await hashSecurityAnswer(answer);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ security_question: question, security_answer_hash: hash })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function changePassword(userId: string, newPassword: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Application period                                                  */
/* ------------------------------------------------------------------ */

export interface ApplicationPeriod {
  deadline: string;
  manuallyClosed: boolean;
  open: boolean;
  change: string | null;
  changedAt: string | null;
}

export async function getApplicationPeriod(): Promise<ApplicationPeriod> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("deadline, manually_closed, deadline_change, deadline_changed_at")
    .eq("id", 1)
    .maybeSingle();

  const deadline = data?.deadline ?? "2026-08-10T23:59:59+01:00";
  const manuallyClosed = data?.manually_closed ?? false;
  return {
    deadline,
    manuallyClosed,
    open: !manuallyClosed && new Date(deadline).getTime() > Date.now(),
    change: data?.deadline_change ?? null,
    changedAt: data?.deadline_changed_at ?? null,
  };
}

export async function assertApplicationsOpen() {
  const period = await getApplicationPeriod();
  if (!period.open) {
    throw new Error("Applications are now closed — please try again later.");
  }
  return period;
}

function formatDeadline(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function setApplicationPeriod(input: { deadline?: string; manuallyClosed?: boolean }) {
  const current = await getApplicationPeriod();
  const patch: {
    deadline?: string;
    manually_closed?: boolean;
    deadline_change?: string | null;
    deadline_changed_at?: string | null;
  } = {};

  if (input.deadline && new Date(input.deadline).getTime() !== new Date(current.deadline).getTime()) {
    const extended = new Date(input.deadline).getTime() > new Date(current.deadline).getTime();
    patch.deadline = input.deadline;
    patch.deadline_change = `Application deadline ${extended ? "extended" : "reduced"} to ${formatDeadline(
      input.deadline,
    )}`;
    patch.deadline_changed_at = new Date().toISOString();
  }

  if (typeof input.manuallyClosed === "boolean" && input.manuallyClosed !== current.manuallyClosed) {
    patch.manually_closed = input.manuallyClosed;
    if (!patch.deadline_change) {
      patch.deadline_change = input.manuallyClosed
        ? "Applications are now closed — please try again later."
        : `Applications are open again until ${formatDeadline(input.deadline ?? current.deadline)}`;
      patch.deadline_changed_at = new Date().toISOString();
    }
  }

  if (Object.keys(patch).length === 0) return current;

  const { error } = await supabaseAdmin.from("app_settings").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
  return getApplicationPeriod();
}

