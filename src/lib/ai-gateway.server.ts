const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const CHAT_MODEL = "openai/gpt-5.6-sol";

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

/** Calls the Lovable AI Gateway chat completions endpoint and returns the reply text. */
export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("The AI assistant is not configured yet.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      reasoning_effort: "none",
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[ai-gateway] request failed [${response.status}]: ${body}`);
    if (response.status === 429) throw new Error("The assistant is busy right now. Please try again shortly.");
    if (response.status === 402) throw new Error("AI credits are exhausted. Please top up to continue.");
    throw new Error("The assistant could not answer right now.");
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
