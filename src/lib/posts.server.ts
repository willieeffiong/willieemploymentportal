import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const AUDIENCES = [
  { value: "all", label: "All applicants / users" },
  { value: "accepted", label: "Accepted applicants" },
  { value: "pending", label: "Pending applicants" },
  { value: "rejected", label: "Rejected applicants" },
  { value: "employed", label: "Employed applicants" },
  { value: "unemployed", label: "Unemployed applicants" },
] as const;

export type Audience = (typeof AUDIENCES)[number]["value"];

export interface MediaItem {
  path: string;
  type: string;
  name: string;
}

export type AlbumKind = "images" | "videos" | "documents" | "text";

export interface FeedPost {
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

/** Groups a post into an album by the kind of media it carries. */
export function albumOf(media: { type: string }[]): AlbumKind {
  if (media.some((m) => m.type.startsWith("video"))) return "videos";
  if (media.some((m) => m.type.startsWith("image"))) return "images";
  if (media.length > 0) return "documents";
  return "text";
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

async function signMedia(media: MediaItem[]) {
  const signed: { url: string; type: string; name: string }[] = [];
  for (const item of media) {
    const { data } = await supabaseAdmin.storage.from("posts").createSignedUrl(item.path, 60 * 60 * 6);
    if (data?.signedUrl) signed.push({ url: data.signedUrl, type: item.type, name: item.name });
  }
  return signed;
}

function matchesAudience(
  audience: string,
  profile: { status: string; employment_status: string } | null,
) {
  if (audience === "all" || !profile) return audience === "all";
  if (audience === "employed") return profile.employment_status === "employed";
  if (audience === "unemployed") return profile.employment_status !== "employed";
  return profile.status === audience;
}

export async function createPost(
  userId: string,
  input: { body: string; audience: Audience; media: MediaItem[] },
) {
  await requireAdmin(userId);
  if (!input.body.trim()) throw new Error("Please add some text to your post before publishing.");

  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      author_id: userId,
      body: input.body.trim(),
      audience: input.audience,
      media: input.media as unknown as Record<string, string>[],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await notifyAudience(input.audience, data.id, albumOf(input.media), input.body.trim());
  return { id: data.id };
}

const ALBUM_LABEL: Record<AlbumKind, string> = {
  images: "a new photo",
  videos: "a new video",
  documents: "a new document",
  text: "a new update",
};

/** Sends a bell notification about a new post to everyone in its audience. */
async function notifyAudience(audience: Audience, postId: string, album: AlbumKind, body: string) {
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, status, employment_status");
  const targets = (profiles ?? []).filter((p) => matchesAudience(audience, p));
  if (!targets.length) return;

  await supabaseAdmin.from("notifications").insert(
    targets.map((p) => ({
      user_id: p.id,
      title: `New post: ${ALBUM_LABEL[album]}`,
      message: body.length > 160 ? `${body.slice(0, 160)}…` : body,
      post_id: postId,
    })),
  );
}

/** Marks a post as seen and clears the notification that pointed at it. */
export async function markPostSeen(userId: string, postId: string) {
  await supabaseAdmin.from("post_views").upsert({ post_id: postId, user_id: userId });
  await supabaseAdmin.from("notifications").delete().eq("user_id", userId).eq("post_id", postId);
  return { ok: true };
}

export async function deletePost(userId: string, postId: string) {
  await requireAdmin(userId);
  const { data: post } = await supabaseAdmin.from("posts").select("media").eq("id", postId).maybeSingle();
  const media = (post?.media as MediaItem[] | null) ?? [];
  if (media.length) {
    await supabaseAdmin.storage.from("posts").remove(media.map((m) => m.path));
  }
  await supabaseAdmin.from("notifications").delete().eq("post_id", postId);
  await supabaseAdmin.from("post_views").delete().eq("post_id", postId);
  await supabaseAdmin.from("post_comments").delete().eq("post_id", postId);
  await supabaseAdmin.from("post_reactions").delete().eq("post_id", postId);
  const { error } = await supabaseAdmin.from("posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
  return { ok: true };
}


export async function listFeed(userId: string): Promise<FeedPost[]> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("status, employment_status")
    .eq("id", userId)
    .maybeSingle();

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  const admin = Boolean(roleRow);

  const { data: posts } = await supabaseAdmin
    .from("posts")
    .select("id, body, audience, media, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const visible = (posts ?? []).filter((p) => admin || matchesAudience(p.audience, profile ?? null));
  if (!visible.length) return [];

  const ids = visible.map((p) => p.id);
  const [{ data: reactions }, { data: comments }, { data: views }] = await Promise.all([
    supabaseAdmin.from("post_reactions").select("post_id, user_id").in("post_id", ids),
    supabaseAdmin
      .from("post_comments")
      .select("id, post_id, user_id, body, created_at")
      .in("post_id", ids)
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("post_views").select("post_id").eq("user_id", userId).in("post_id", ids),
  ]);
  const seenIds = new Set((views ?? []).map((v) => v.post_id));

  const authorIds = [...new Set((comments ?? []).map((c) => c.user_id))];
  const { data: authors } = authorIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = (id: string) => authors?.find((a) => a.id === id)?.full_name || "Portal user";

  return Promise.all(
    visible.map(async (post) => {
      const media = await signMedia((post.media as MediaItem[] | null) ?? []);
      return {
        id: post.id,
        body: post.body,
        audience: post.audience,
        created_at: post.created_at,
        media,
        reactions: (reactions ?? []).filter((r) => r.post_id === post.id).length,
        reacted: (reactions ?? []).some((r) => r.post_id === post.id && r.user_id === userId),
        comments: (comments ?? [])
          .filter((c) => c.post_id === post.id)
          .map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: nameOf(c.user_id) })),
        album: albumOf(media),
        seen: admin || seenIds.has(post.id),
      };
    }),
  );

}

export async function toggleReaction(userId: string, postId: string) {
  const { data: existing } = await supabaseAdmin
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
    return { reacted: false };
  }
  const { error } = await supabaseAdmin.from("post_reactions").insert({ post_id: postId, user_id: userId });
  if (error) throw new Error(error.message);
  return { reacted: true };
}

export async function addComment(userId: string, postId: string, body: string) {
  const { error } = await supabaseAdmin
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, body: body.trim() });
  if (error) throw new Error(error.message);
  return { ok: true };
}
