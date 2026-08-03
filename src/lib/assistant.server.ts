import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatComplete, chatStream, type ChatContent, type ChatMessage } from "./ai-gateway.server";
import { PROGRAMME_FACTS } from "./portal-data";

export const ASSISTANT_NAME = "Willie Lab Tech AI";

export interface Attachment {
  name: string;
  type: string;
  path: string;
}

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
    .select("id, role, content, created_at, attachment_name, attachment_type, attachment_path")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function deleteThread(userId: string, threadId: string) {
  await supabaseAdmin.from("chat_messages").delete().eq("user_id", userId).eq("thread_id", threadId);
  await supabaseAdmin.from("chat_threads").delete().eq("user_id", userId).eq("id", threadId);
  return { ok: true };
}

/** Builds the model content for one stored message, inlining any attachment. */
async function contentFor(message: {
  content: string;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_path: string | null;
}): Promise<ChatContent> {
  if (!message.attachment_path || !message.attachment_type) return message.content;

  const { data, error } = await supabaseAdmin.storage.from("chat-uploads").download(message.attachment_path);
  if (error || !data) return message.content;

  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  const dataUrl = `data:${message.attachment_type};base64,${btoa(binary)}`;

  if (message.attachment_type.startsWith("image/")) {
    return [
      { type: "text", text: message.content },
      { type: "image_url", image_url: { url: dataUrl } },
    ];
  }
  return [
    { type: "text", text: message.content },
    { type: "file", file: { filename: message.attachment_name ?? "document", file_data: dataUrl } },
  ];
}

async function systemPrompt(userId: string) {
  const admin = await isAdmin(userId);
  return `You are ${ASSISTANT_NAME}, the research and study assistant of the Willie Lab Tech empowerment portal. You help with general knowledge, research, study and engineering questions, with uploaded images or documents, and with questions about this portal.

${PROGRAMME_FACTS}

${
  admin
    ? await portalSnapshot()
    : "You are speaking with an applicant. Never reveal other applicants' personal data or portal statistics; you may explain the programme, the sponsor, the engineering fields and how to apply."
}

Answer clearly and concisely in markdown. Keep answers under 400 words unless more detail is requested.`;
}

/** Stores the user turn (creating the thread when needed) and returns the model messages. */
export async function prepareTurn(
  userId: string,
  input: { threadId?: string | null; message: string; attachment?: Attachment | null },
) {
  let threadId = input.threadId ?? null;

  if (!threadId) {
    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({ user_id: userId, title: input.message.slice(0, 60) || "New chat" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    threadId = data.id;
  }

  const { error: insertError } = await supabaseAdmin.from("chat_messages").insert({
    thread_id: threadId,
    user_id: userId,
    role: "user",
    content: input.message,
    attachment_name: input.attachment?.name ?? null,
    attachment_type: input.attachment?.type ?? null,
    attachment_path: input.attachment?.path ?? null,
  });
  if (insertError) throw new Error(insertError.message);

  const history = (await threadMessages(userId, threadId)).slice(-16);
  const messages: ChatMessage[] = [{ role: "system", content: await systemPrompt(userId) }];
  for (const m of history) {
    messages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.role === "assistant" ? m.content : await contentFor(m),
    });
  }

  return { threadId, messages };
}

export async function saveAssistantReply(userId: string, threadId: string, reply: string) {
  await supabaseAdmin
    .from("chat_messages")
    .insert({ thread_id: threadId, user_id: userId, role: "assistant", content: reply });
  await supabaseAdmin
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function streamAssistant(
  userId: string,
  input: { threadId?: string | null; message: string; attachment?: Attachment | null },
) {
  const { threadId, messages } = await prepareTurn(userId, input);
  const body = await chatStream(messages);
  return { threadId, body };
}

/** Non-streaming fallback used by the server function API. */
export async function askAssistant(
  userId: string,
  input: { threadId?: string | null; message: string; attachment?: Attachment | null },
) {
  const { threadId, messages } = await prepareTurn(userId, input);
  const reply = (await chatComplete(messages)) || "I could not produce an answer. Please try again.";
  await saveAssistantReply(userId, threadId, reply);
  return { threadId, reply };
}
