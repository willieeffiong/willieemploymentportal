import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, FileText, Heart, Images, MessageSquare, Trash2, Video } from "lucide-react";
import {
  commentOnPost,
  deleteUpdatePost,
  listUpdateFeed,
  markPostSeen,
  reactToPost,
} from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilePreview } from "@/components/FilePreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AlbumKind = "images" | "videos" | "documents" | "text";

interface FeedPost {
  id: string;
  body: string;
  audience: string;
  created_at: string;
  media: { url: string; type: string; name: string }[];
  reactions: number;
  reacted: boolean;
  comments: { id: string; body: string; created_at: string; author: string }[];
  album: AlbumKind;
  seen: boolean;
}

const ALBUMS: { key: AlbumKind; label: string; blurb: string; icon: typeof Images }[] = [
  { key: "images", label: "Images", blurb: "Photo updates", icon: Images },
  { key: "videos", label: "Videos", blurb: "Video updates", icon: Video },
  { key: "documents", label: "Documents", blurb: "Files and documents", icon: FileText },
];

/** Facebook-style updates feed with new-post highlights and albums by media type. */
export function UpdatesFeed({ isAdmin = false }: { isAdmin?: boolean }) {
  const loadFeed = useServerFn(listUpdateFeed);
  const react = useServerFn(reactToPost);
  const comment = useServerFn(commentOnPost);
  const removePost = useServerFn(deleteUpdatePost);
  const seen = useServerFn(markPostSeen);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openAlbum, setOpenAlbum] = useState<AlbumKind | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = (await loadFeed()) as FeedPost[];
    setPosts(rows);
  }, [loadFeed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fresh = useMemo(() => posts.filter((p) => !p.seen), [posts]);

  async function markSeen(postId: string) {
    if (isAdmin) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, seen: true } : p)));
    try {
      await seen({ data: { postId } });
    } catch {
      /* the post simply stays highlighted until the next refresh */
    }
  }

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
    setConfirmId(null);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await removePost({ data: { postId } });
      toast.success("Post deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that post.");
      void refresh();
    }
  }

  function PostCard({ post, isNew = false }: { post: FeedPost; isNew?: boolean }) {
    return (
      <article
        className={`overflow-hidden rounded-xl border bg-card shadow-soft ${
          isNew ? "border-2 border-accent" : ""
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">
              Willie Lab Tech
              {isNew ? (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                  NEW
                </span>
              ) : null}
            </p>
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
              onClick={() => setConfirmId(post.id)}
              className="rounded-md p-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {post.media.length > 0 ? (
          <div className="grid gap-2 px-4 pb-3 sm:grid-cols-2">
            {post.media.map((item) => (
              <div key={item.url} onClick={() => void markSeen(post.id)}>
                <FilePreview file={item} />
              </div>
            ))}
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
          {isNew ? (
            <button
              type="button"
              onClick={() => void markSeen(post.id)}
              className="ml-auto text-xs font-semibold text-primary underline"
            >
              Mark as viewed
            </button>
          ) : null}
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
    );
  }

  if (posts.length === 0) return null;

  if (openAlbum) {
    const inAlbum = posts.filter((p) => p.album === openAlbum);
    const meta = ALBUMS.find((a) => a.key === openAlbum);
    return (
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setOpenAlbum(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to updates
        </button>
        <h2 className="text-xl font-bold text-primary">
          {meta?.label} album <span className="text-sm font-normal text-muted-foreground">({inAlbum.length})</span>
        </h2>
        <div
          className={`grid gap-4 ${
            inAlbum.length === 1 ? "grid-cols-1" : inAlbum.length < 5 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {inAlbum.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold text-primary">Updates</h2>

      <div className="grid grid-cols-3 gap-3">
        {ALBUMS.map((album) => {
          const inAlbum = posts.filter((p) => p.album === album.key);
          const cover = inAlbum.flatMap((p) => p.media)[0];
          const hasNew = inAlbum.some((p) => !p.seen);
          const Icon = album.icon;
          return (
            <button
              key={album.key}
              type="button"
              disabled={inAlbum.length === 0}
              onClick={() => setOpenAlbum(album.key)}
              className={`overflow-hidden rounded-xl border bg-card text-left shadow-soft disabled:opacity-50 ${
                hasNew ? "ring-2 ring-accent" : ""
              }`}
            >
              <span className="relative block h-24 w-full bg-secondary">
                {cover && cover.type.startsWith("image") ? (
                  <img src={cover.url} alt={`${album.label} album cover`} className="h-24 w-full object-cover" />
                ) : (
                  <span className="grid h-24 w-full place-items-center text-primary">
                    <Icon className="h-8 w-8" />
                  </span>
                )}
                {hasNew ? (
                  <span className="absolute top-1 right-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    NEW
                  </span>
                ) : null}
              </span>
              <span className="block px-2 py-2">
                <span className="block text-sm font-bold text-primary">{album.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {album.blurb} · {inAlbum.length}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {fresh.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold tracking-wide text-accent uppercase">New posts</h3>
          {fresh.map((post) => (
            <PostCard key={post.id} post={post} isNew />
          ))}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">All posts</h3>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}

      <Dialog open={Boolean(confirmId)} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>Are you sure you want to delete this post?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmId && void remove(confirmId)}
            >
              Yes
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setConfirmId(null)}>
              No
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
