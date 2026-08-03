import { createFileRoute } from "@tanstack/react-router";

interface AssistantRequest {
  threadId?: string | null;
  message?: string;
  attachment?: { name: string; type: string; path: string } | null;
}

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        const userId = auth?.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const payload = (await request.json()) as AssistantRequest;
        const message = (payload.message ?? "").trim();
        if (!message) return new Response("A message is required", { status: 400 });

        const { streamAssistant, saveAssistantReply } = await import("@/lib/assistant.server");

        let threadId: string;
        let upstream: ReadableStream<Uint8Array>;
        try {
          const started = await streamAssistant(userId, {
            threadId: payload.threadId ?? null,
            message,
            attachment: payload.attachment ?? null,
          });
          threadId = started.threadId;
          upstream = started.body;
        } catch (error) {
          const messageText = error instanceof Error ? error.message : "The assistant is unavailable.";
          return new Response(messageText, { status: 500 });
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let full = "";
        let buffer = "";

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (!data || data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      full += delta;
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    /* ignore partial frames */
                  }
                }
              }
            } finally {
              await saveAssistantReply(
                userId,
                threadId,
                full.trim() || "I could not produce an answer. Please try again.",
              );
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Thread-Id": threadId,
          },
        });
      },
    },
  },
});
