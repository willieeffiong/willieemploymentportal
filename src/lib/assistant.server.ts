import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatComplete, type ChatMessage } from "./ai-gateway.server";
import { PROGRAMME_FACTS } from "./portal-data";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

async function portalSnapshot() {
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("status, employment_status, state, engineering_field, qualification, submitted_at");

  const submitted = (profiles ?? []).filter((p) => p.submitted_at);
  const tally = (key: "state" | "engineering_field" | "qualification") => {
    const counts: Record<string, number> = {};
    submitted.forEach((p) => {
      const value = (p[key] as string | null) ?? "Unspecified";
      counts[value] = (counts[value] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
  };

  return `Live portal data (submitted applications only):
Total submitted: ${submitted.length}
Pending: ${submitted.filter((p) => p.status === "pending").length}
Accepted: ${submitted.filter((p) => p.status === "accepted").length}
Rejected: ${submitted.filter((p) => p.status === "rejected").length}
Employed: ${submitted.filter((p) => p.employment_status === "employed").length}
By state -> ${tally("state")}
By engineering field -> ${tally("engineering_field")}
By qualification -> ${tally("qualification")}`;
}

export async function listThreads(userId: string) {
  const { data } = await supabaseAdmin
    .from("chat_threads")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function threadMessages(userId: string, threadId: string) {
  const { data } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function deleteThread(userId: string, threadId: string) {
  await supabaseAdmin.from("chat_threads").delete().eq("user_id", userId).eq("id", threadId);
  return { ok: true };
}

export async function askAssistant(userId: string, input: { threadId?: string | null; message: string }) {
  let threadId = input.threadId ?? null;

  if (!threadId) {
    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({ user_id: userId, title: input.message.slice(0, 60) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    threadId = data.id;
  }

  const { error: userInsertError } = await supabaseAdmin
    .from("chat_messages")
    .insert({ thread_id: threadId, user_id: userId, role: "user", content: input.message });
  if (userInsertError) throw new Error(userInsertError.message);

  const history = await threadMessages(userId, threadId);
  const admin = await isAdmin(userId);

  const system = `You are the Willie Lab Tech Research Assistant. You help with general knowledge, research, study and engineering questions, and with questions about this portal.

${PROGRAMME_FACTS}

${admin ? await portalSnapshot() : "You are speaking with an applicant. Never reveal other applicants' personal data or portal statistics; you may explain the programme, the sponsor, the engineering fields and how to apply."}

Answer clearly and concisely in markdown. Keep answers under 400 words unless more detail is requested.`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history.slice(-20).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  const reply = (await chatComplete(messages)) || "I could not produce an answer. Please try again.";

  await supabaseAdmin
    .from("chat_messages")
    .insert({ thread_id: threadId, user_id: userId, role: "assistant", content: reply });
  await supabaseAdmin
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return { threadId, reply };
}
