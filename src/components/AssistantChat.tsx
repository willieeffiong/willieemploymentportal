import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History, Mic, Paperclip, Send, Square, Trash2, Volume2, X } from "lucide-react";
import aiIcon from "@/assets/ai-icon.png";
import { supabase } from "@/integrations/supabase/client";
import {
  assistantDeleteThread,
  assistantSpeak,
  assistantThreadMessages,
  assistantThreads,
  assistantTranscribe,
} from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/MathText";
import { LocalFilePreviews } from "@/components/FilePreview";


export const ASSISTANT_NAME = "WILLSVAYNE AI";

export function AssistantIcon({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-foreground ring-2 ring-accent ${className}`}
    >
      <img src={aiIcon} alt={`${ASSISTANT_NAME} icon`} className="h-full w-full object-cover" />
    </span>
  );
}

/** The AI mark with an orbital ring spinning around it while a reply is being generated. */
export function AssistantThinking() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative grid h-11 w-11 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent border-t-transparent border-r-transparent" />
        <AssistantIcon className="h-8 w-8" />
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{ASSISTANT_NAME} is thinking…</span>
    </div>
  );
}

interface Turn {
  id: string;
  role: string;
  content: string;
  attachment_name?: string | null;
}

interface ThreadRow {
  id: string;
  title: string;
}

/** Full chat surface for Willie Lab Tech AI: history, attachments, voice input and read-aloud. */
export function AssistantChat() {
  const listThreads = useServerFn(assistantThreads);
  const loadThread = useServerFn(assistantThreadMessages);
  const removeThread = useServerFn(assistantDeleteThread);
  const transcribe = useServerFn(assistantTranscribe);
  const speak = useServerFn(assistantSpeak);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refreshThreads = useCallback(async () => {
    const rows = (await listThreads()) as ThreadRow[];
    setThreads(rows);
  }, [listThreads]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [turns, scrollToBottom]);

  async function openThread(id: string) {
    setThreadId(id);
    setHistoryOpen(false);
    const rows = (await loadThread({ data: { threadId: id } })) as Turn[];
    setTurns(rows);
  }

  async function deleteThread(id: string) {
    await removeThread({ data: { threadId: id } });
    if (threadId === id) {
      setThreadId(null);
      setTurns([]);
    }
    void refreshThreads();
  }

  async function uploadAttachment(userId: string, chosen: File) {
    const path = `${userId}/${Date.now()}-${chosen.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(path, chosen);
    if (error) throw new Error(error.message);
    return { path, name: chosen.name, type: chosen.type || "application/octet-stream" };
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token;
    const userId = auth.session?.user.id;
    if (!token || !userId) return toast.error("Please sign in again.");

    let attachment: { path: string; name: string; type: string } | null = null;
    setStreaming(true);
    try {
      if (file) attachment = await uploadAttachment(userId, file);
    } catch (error) {
      setStreaming(false);
      return toast.error(error instanceof Error ? error.message : "Could not upload that file.");
    }

    setInput("");
    setFile(null);
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text, attachment_name: attachment?.name ?? null },
    ]);
    const assistantId = `a-${Date.now()}`;
    setTurns((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ threadId, message: text, attachment }),
      });
      if (!response.ok || !response.body) {
        throw new Error((await response.text()) || "The assistant could not answer.");
      }
      const newThreadId = response.headers.get("X-Thread-Id");
      if (newThreadId) setThreadId(newThreadId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTurns((prev) =>
          prev.map((t) => (t.id === assistantId ? { ...t, content: t.content + chunk } : t)),
        );
        scrollToBottom();
      }
      void refreshThreads();
    } catch (error) {
      setTurns((prev) => prev.filter((t) => t.id !== assistantId));
      toast.error(error instanceof Error ? error.message : "The assistant could not answer.");
    } finally {
      setStreaming(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 2048) {
          toast.error("That recording was empty — please try again.");
          return;
        }
        setWorking(true);
        try {
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          const result = await transcribe({
            data: { audio: btoa(binary), mimeType: blob.type || "audio/webm" },
          });
          setInput((prev) => (prev ? `${prev} ${result.text}` : result.text));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not transcribe your recording.");
        } finally {
          setWorking(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to record your question.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function readAloud(text: string) {
    setWorking(true);
    try {
      const { audio } = await speak({ data: { text } });
      audioRef.current?.pause();
      const player = new Audio(`data:audio/mpeg;base64,${audio}`);
      audioRef.current = player;
      await player.play();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that out.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className={`rounded-xl border bg-card p-3 shadow-soft ${historyOpen ? "" : "hidden lg:block"}`}>
        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => {
            setThreadId(null);
            setTurns([]);
            setHistoryOpen(false);
          }}
        >
          New chat
        </Button>
        <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Saved conversations
        </p>
        <ul className="mt-2 space-y-1">
          {threads.length === 0 ? (
            <li className="px-2 text-sm text-muted-foreground">No conversations yet.</li>
          ) : null}
          {threads.map((thread) => (
            <li key={thread.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void openThread(thread.id)}
                className={`min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-sm ${
                  threadId === thread.id ? "bg-secondary font-semibold text-primary" : "hover:bg-secondary"
                }`}
              >
                {thread.title}
              </button>
              <button
                type="button"
                aria-label={`Delete ${thread.title}`}
                onClick={() => void deleteThread(thread.id)}
                className="rounded-md p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-h-[70vh] flex-col rounded-xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex items-center gap-3">
          <AssistantIcon />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-primary">{ASSISTANT_NAME}</h1>
            <p className="truncate text-xs text-muted-foreground">
              Ask anything, upload a file, or speak your question.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto lg:hidden"
            onClick={() => setHistoryOpen((prev) => !prev)}
          >
            <History className="mr-1 h-4 w-4" /> History
          </Button>
        </div>

        <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-lg bg-secondary p-3">
          {turns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Start a conversation — ask a research question, paste a topic, or upload a document.
            </p>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
                  turn.role === "assistant"
                    ? "bg-card text-foreground"
                    : "ml-auto bg-primary text-primary-foreground"
                }`}
              >
                {turn.attachment_name ? (
                  <p className="mb-1 text-xs font-semibold opacity-80">📎 {turn.attachment_name}</p>
                ) : null}
                {turn.content ? (
                  <MathText text={turn.content} />
                ) : turn.role === "assistant" && streaming ? (
                  <AssistantThinking />
                ) : null}
                {turn.role === "assistant" && turn.content ? (
                  <button
                    type="button"
                    onClick={() => void readAloud(turn.content)}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary underline"
                  >
                    <Volume2 className="h-3 w-3" /> Read aloud
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>


        {file ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
            <Paperclip className="h-4 w-4 text-primary" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="sticky bottom-0 mt-3 flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-soft">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            aria-label="Attach an image or document"
            onClick={() => fileRef.current?.click()}
            className="rounded-full p-2 text-muted-foreground hover:text-primary"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            rows={1}
            onChange={(event) => {
              setInput(event.target.value);
              const node = event.currentTarget;
              node.style.height = "auto";
              node.style.height = `${Math.min(node.scrollHeight, 72)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={`Ask ${ASSISTANT_NAME}…`}
            className="max-h-[72px] min-h-[24px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm leading-6 outline-none"
          />
          <button
            type="button"
            aria-label={recording ? "Stop recording" : "Record your question"}
            onClick={() => (recording ? stopRecording() : void startRecording())}
            className={`rounded-full p-2 ${recording ? "text-destructive" : "text-muted-foreground hover:text-primary"}`}
          >
            {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            aria-label="Send message"
            onClick={() => void send()}
            disabled={streaming || working || !input.trim()}
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {working ? <p className="mt-2 text-xs text-muted-foreground">Processing audio…</p> : null}
      </div>
    </section>
  );
}

/** Home-page entry point that invites the user into the AI chat page. */
export function AssistantBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-xl border-2 border-accent bg-card p-4 text-left shadow-soft transition-colors hover:bg-secondary"
    >
      <AssistantIcon className="h-12 w-12" />
      <span className="min-w-0">
        <span className="block font-bold text-primary">{ASSISTANT_NAME}</span>
        <span className="block text-sm text-muted-foreground">
          Ask a question or start research — tap to open the assistant.
        </span>
      </span>
    </button>
  );
}
