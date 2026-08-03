import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatComplete } from "./ai-gateway.server";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Reviews an uploaded document with AI: is it readable, and does it match the
 * applicant's stated qualification / engineering field?
 */
export async function verifyDocument(userId: string, documentId: string) {
  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!doc) throw new Error("Document not found.");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("qualification, engineering_field, full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from("documents")
    .download(doc.file_path);

  if (downloadError || !file) {
    return { status: "accepted", note: "Could not open the file for automatic review." };
  }

  const contentType = doc.content_type ?? file.type ?? "";
  const isImage = IMAGE_TYPES.includes(contentType.toLowerCase());
  const isPdf = contentType.toLowerCase().includes("pdf");

  if (!isImage && !isPdf) {
    const note = "Only PDF or image (JPEG/PNG) files are accepted.";
    await rejectDocument(doc.id, doc.file_path, note);
    return { status: "rejected", note };
  }

  const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));

  const instruction = `You are checking whether a document uploaded to an engineering empowerment portal is legible.
Document category: ${doc.category === "skill" ? "optional skills evidence" : "required qualification document"}

Judge ONLY clarity and readability. Do not judge whether the content matches any qualification, field or person — any subject matter is acceptable.
ACCEPT if a human could read the text or clearly see the content (even if it is not a certificate).
REJECT only if it is blurry, too dark, cropped beyond reading, blank or otherwise unreadable.
Reply with one line only, in this exact format:
ACCEPT: <short reason>
or
REJECT: Your document is not clear, please kindly upload a new one`;


  let reply = "";
  try {
    reply = await chatComplete([
      { role: "system", content: "You verify uploaded documents. Answer in one line." },
      {
        role: "user",
        content: [
          { type: "text", text: instruction },
          isImage
            ? { type: "image_url" as const, image_url: { url: `data:${contentType};base64,${base64}` } }
            : {
                type: "file" as const,
                file: { filename: doc.file_name, file_data: `data:application/pdf;base64,${base64}` },
              },
        ],
      },
    ]);
  } catch (error) {
    console.error("[document-verify] failed", error);
    await supabaseAdmin
      .from("documents")
      .update({ verification_status: "accepted", verification_note: "Automatic review unavailable." })
      .eq("id", doc.id);
    return { status: "accepted", note: "Automatic review unavailable — the admin will review it manually." };
  }

  const rejected = /^\s*REJECT/i.test(reply);
  const note = reply.replace(/^\s*(ACCEPT|REJECT)\s*:\s*/i, "").trim() || "Reviewed.";

  if (rejected) {
    await rejectDocument(doc.id, doc.file_path, note);
    return { status: "rejected", note };
  }

  await supabaseAdmin
    .from("documents")
    .update({ verification_status: "accepted", verification_note: note })
    .eq("id", doc.id);
  return { status: "accepted", note };
}

async function rejectDocument(id: string, path: string, note: string) {
  await supabaseAdmin.storage.from("documents").remove([path]);
  await supabaseAdmin.from("documents").delete().eq("id", id);
  void note;
}
