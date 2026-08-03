import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMail } from "./email.server";

const ADMIN_EMAIL = "willieeffiong52@gmail.com";

export const CONTACT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
  phone: /^\+?[0-9][0-9\s-]{7,17}$/,
  facebook: /^(https?:\/\/)?(www\.|m\.|web\.)?facebook\.com\/[^\s]{2,}$/i,
};

export function isValidContact(value: string) {
  const v = value.trim();
  return CONTACT_PATTERNS.email.test(v) || CONTACT_PATTERNS.phone.test(v) || CONTACT_PATTERNS.facebook.test(v);
}

export async function submitPublicMessage(input: { body: string; gender: string; contact: string }) {
  if (!isValidContact(input.contact)) {
    throw new Error("That contact detail is invalid. Enter a valid phone number, email address or Facebook link.");
  }

  const { error } = await supabaseAdmin.from("public_messages").insert({
    body: input.body.trim(),
    gender: input.gender,
    contact: input.contact.trim(),
  });
  if (error) throw new Error(error.message);

  await sendMail({
    to: ADMIN_EMAIL,
    subject: "New enquiry from the Willie Lab Tech portal",
    html: `<p>A new enquiry was sent through the Contact Us page. Please log in to the admin portal to read it.</p>`,
  }).catch(() => undefined);

  return { ok: true };
}

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
}

export async function listPublicMessages(userId: string) {
  await requireAdmin(userId);
  const { data } = await supabaseAdmin
    .from("public_messages")
    .select("id, body, gender, contact, read_by_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function markPublicMessagesRead(userId: string) {
  await requireAdmin(userId);
  await supabaseAdmin.from("public_messages").update({ read_by_admin: true }).eq("read_by_admin", false);
  return { ok: true };
}
