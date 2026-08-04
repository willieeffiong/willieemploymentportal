import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ExtraProvider {
  baseUrl: string;
  model: string;
  apiKey: string;
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

/** Returns the admin-configured extra AI provider without exposing the stored key. */
export async function readExtraProvider(userId: string) {
  await requireAdmin(userId);
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("extra_ai_base_url, extra_ai_model, extra_ai_key")
    .eq("id", 1)
    .maybeSingle();

  return {
    baseUrl: data?.extra_ai_base_url ?? "",
    model: data?.extra_ai_model ?? "",
    connected: Boolean(data?.extra_ai_key && data?.extra_ai_base_url && data?.extra_ai_model),
  };
}

/** Saves (or clears) the extra AI provider and verifies it answers before storing it. */
export async function writeExtraProvider(userId: string, input: ExtraProvider) {
  await requireAdmin(userId);

  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const model = input.model.trim();
  const apiKey = input.apiKey.trim();

  if (!baseUrl && !model && !apiKey) {
    await supabaseAdmin
      .from("app_settings")
      .update({ extra_ai_base_url: null, extra_ai_model: null, extra_ai_key: null })
      .eq("id", 1);
    return { connected: false, message: "Extra AI disconnected. Your assistant now uses Willie Lab Tech AI only." };
  }

  if (!/^https:\/\//i.test(baseUrl)) throw new Error("Enter the AI service address starting with https://");
  if (!model) throw new Error("Enter the model name for that AI service.");
  if (!apiKey) throw new Error("Enter the API key for that AI service.");

  const probe = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }] }),
  }).catch(() => null);

  if (!probe) throw new Error("That AI service could not be reached. Check the address and try again.");
  if (!probe.ok) {
    const body = await probe.text().catch(() => "");
    console.error(`[extra-ai] verification failed [${probe.status}]: ${body}`);
    throw new Error(`That AI service rejected the key (status ${probe.status}). Check the key and model name.`);
  }

  const { error } = await supabaseAdmin
    .from("app_settings")
    .update({ extra_ai_base_url: baseUrl, extra_ai_model: model, extra_ai_key: apiKey })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  return { connected: true, message: "Connected. Your assistant will now use this AI service." };
}

/** Loads the active extra provider for the assistant, or null when none is configured. */
export async function activeExtraProvider(): Promise<ExtraProvider | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("extra_ai_base_url, extra_ai_model, extra_ai_key")
    .eq("id", 1)
    .maybeSingle();

  if (!data?.extra_ai_base_url || !data.extra_ai_model || !data.extra_ai_key) return null;
  return { baseUrl: data.extra_ai_base_url, model: data.extra_ai_model, apiKey: data.extra_ai_key };
}
