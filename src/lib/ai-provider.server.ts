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

/** Guesses a sensible endpoint and model from the shape of the API key. */
function defaultsForKey(apiKey: string): { baseUrl: string; model: string } {
  if (/^sk-ant-/i.test(apiKey)) {
    return { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" };
  }
  if (/^gsk_/i.test(apiKey)) {
    return { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" };
  }
  if (/^sk-or-/i.test(apiKey)) {
    return { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" };
  }
  if (/^AIza/.test(apiKey)) {
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.0-flash",
    };
  }
  if (/^xai-/i.test(apiKey)) return { baseUrl: "https://api.x.ai/v1", model: "grok-2-latest" };
  if (/^r8_/i.test(apiKey)) return { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" };
  return { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" };
}

/** Saves (or clears) the extra AI provider. Only the API key is required. */
export async function writeExtraProvider(userId: string, input: ExtraProvider) {
  await requireAdmin(userId);

  const apiKey = input.apiKey.trim();
  let baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  let model = input.model.trim();

  if (!baseUrl && !model && !apiKey) {
    await supabaseAdmin
      .from("app_settings")
      .update({ extra_ai_base_url: null, extra_ai_model: null, extra_ai_key: null })
      .eq("id", 1);
    return { connected: false, message: "Extra AI disconnected. Your assistant now uses Willie Lab Tech AI only." };
  }

  if (!apiKey) throw new Error("Enter the API key for that AI service.");

  const guessed = defaultsForKey(apiKey);
  if (!baseUrl) baseUrl = guessed.baseUrl;
  if (!model) model = guessed.model;
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;

  const { error } = await supabaseAdmin
    .from("app_settings")
    .update({ extra_ai_base_url: baseUrl, extra_ai_model: model, extra_ai_key: apiKey })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  return {
    connected: true,
    message: `Saved and live. WILLSVAYNE AI will now use ${model} at ${baseUrl}, and falls back to Willie Lab Tech AI if that service fails.`,
  };
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
