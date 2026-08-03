import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart, MessageSquare, Trash2 } from "lucide-react";
import { commentOnPost, deleteUpdatePost, listUpdateFeed, reactToPost } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FeedPost {
  id: string;
  body: string;
  audience: string;
  created_at: string;
  media: { url: string; type: string; name: string }[];
  reactions: number;
  reacted: boolean;
  comments: { id: string; body: string; created_at: string; author: string }[];
}

/** Facebook-style updates feed shared by the applicant and admin portals. */
export function UpdatesFeed({ isAdmin = false }: { isAdmin?: boolean }) {
  const loadFeed = useServerFn(listUpdateFeed);
  const react = useServerFn(reactToPost);
  const comment = useServerFn(commentOnPost);
  const removePost = useServerFn(deleteUpdatePost);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const rows = (await loadFeed()) as FeedPost[];
    setPosts(rows);
  }, [loadFeed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(postId: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, reacted: !p.reacted, reactions: p.reactions + (p.reacted ? -1 : 1) }
          : p,
      ),
    );
    try {
      await react({ data: { postId } });
    } catch {
      void refresh();
    }
  }

  async function addComment(postId: string) {
    const body = (drafts[postId] ?? "").trim();
    if (!body) return;
    setDrafts((prev) => ({ ...prev, [postId]: "" }));
    try {
      await comment({ data: { postId, body } });
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post your comment.");
    }
  }

  async function remove(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await removePost({ data: { postId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that post.");
      void refresh();
    }
  }

  if (posts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-primary">Updates</h2>
      {posts.map((post) => (
        <article key={post.id} className="overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary">Willie Lab Tech</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(post.created_at).toLocaleString()}
                {isAdmin ? ` · audience: ${post.audience}` : ""}
              </p>
              <p className="mt-2 text-sm whitespace-pre-wrap text-foreground">{post.body}</p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                aria-label="Delete post"
                onClick={() => void remove(post.id)}
                className="rounded-md p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {post.media.length > 0 ? (
            <div className="grid gap-1 sm:grid-cols-2">
              {post.media.map((item) =>
                item.type.startsWith("video") ? (
                  <video key={item.url} src={item.url} controls className="w-full bg-black" />
                ) : (
                  <img key={item.url} src={item.url} alt={item.name} loading="lazy" className="w-full object-cover" />
                ),
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-4 border-t px-4 py-2">
            <button
              type="button"
              onClick={() => void toggle(post.id)}
              className={`flex items-center gap-1 text-sm font-semibold ${
                post.reacted ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <Heart className={`h-4 w-4 ${post.reacted ? "fill-current" : ""}`} /> {post.reactions}
            </button>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" /> {post.comments.length}
            </span>
          </div>

          <div className="space-y-2 border-t bg-secondary/50 px-4 py-3">
            {post.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-card px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-primary">{c.author}</p>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={drafts[post.id] ?? ""}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                placeholder="Write a comment…"
                maxLength={2000}
              />
              <Button
                onClick={() => void addComment(post.id)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Post
              </Button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
