const BASE_URL = "https://ai.gateway.lovable.dev/v1";

export const CHAT_MODEL = "openai/gpt-5.6-sol";
export const TRANSCRIBE_MODEL = "openai/gpt-4o-transcribe";
export const TTS_MODEL = "openai/gpt-4o-mini-tts";

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file"; file: { filename: string; file_data: string } }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("The AI assistant is not configured yet.");
  return key;
}

function failure(status: number, body: string): Error {
  console.error(`[ai-gateway] request failed [${status}]: ${body}`);
  if (status === 429) return new Error("The assistant is busy right now. Please try again shortly.");
  if (status === 402) return new Error("AI credits are exhausted. Please top up to continue.");
  return new Error("The assistant could not answer right now.");
}

export interface ProviderOverride {
  baseUrl: string;
  model: string;
  apiKey: string;
}

function target(override?: ProviderOverride | null) {
  if (override) {
    return {
      url: `${override.baseUrl}/chat/completions`,
      key: override.apiKey,
      body: { model: override.model } as Record<string, unknown>,
    };
  }
  return {
    url: `${BASE_URL}/chat/completions`,
    key: apiKey(),
    body: { model: CHAT_MODEL, reasoning_effort: "none" } as Record<string, unknown>,
  };
}

/** Calls the chat completions endpoint and returns the reply text. */
export async function chatComplete(messages: ChatMessage[], override?: ProviderOverride | null): Promise<string> {
  const t = target(override);
  const response = await fetch(t.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` },
    body: JSON.stringify({ ...t.body, messages }),
  });

  if (!response.ok) throw failure(response.status, await response.text());

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Opens a streaming chat completion. Returns the raw SSE body for the caller to parse. */
export async function chatStream(
  messages: ChatMessage[],
  override?: ProviderOverride | null,
): Promise<ReadableStream<Uint8Array>> {
  const t = target(override);
  const response = await fetch(t.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` },
    body: JSON.stringify({ ...t.body, stream: true, messages }),
  });

  if (!response.ok || !response.body) throw failure(response.status, await response.text().catch(() => ""));
  return response.body;
}


/** Transcribes a recorded audio clip and returns the text. */
export async function transcribeAudio(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", audio, filename);

  const response = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[ai-gateway] transcription failed [${response.status}]: ${body}`);
    throw new Error("That recording could not be understood. Please try again.");
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Renders text to speech and returns base64-encoded MP3 audio. */
export async function speakText(text: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text.slice(0, 4000),
      voice: "alloy",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[ai-gateway] speech failed [${response.status}]: ${body}`);
    throw new Error("The assistant could not read that out loud right now.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
