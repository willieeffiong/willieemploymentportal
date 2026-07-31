import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  securityQuestion: z.string().trim().min(5).max(200),
  securityAnswer: z.string().trim().min(2).max(120),
});

const reviewSchema = z.object({
  applicantId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(1000).optional(),
});

const bulkReviewSchema = z.object({
  applicantIds: z.array(z.string().uuid()).min(1).max(200),
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(1000).optional(),
});

const employmentSchema = z.object({
  applicantId: z.string().uuid(),
  employmentStatus: z.enum(["pending", "employed", "not_qualified"]),
  note: z.string().trim().max(500).optional(),
});

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const registerApplicant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { register } = await import("./portal-actions.server");
    return register(data);
  });

export const ensureAdminAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { ensureAdmin } = await import("./portal-actions.server");
  return ensureAdmin();
});

export const listApplicants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminListApplicants } = await import("./portal-actions.server");
    return adminListApplicants(context.userId);
  });

export const getApplicant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ applicantId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { adminGetApplicant } = await import("./portal-actions.server");
    return adminGetApplicant(context.userId, data.applicantId);
  });

export const reviewApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reviewSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { adminReview } = await import("./portal-actions.server");
    return adminReview(context.userId, data);
  });

export const bulkReviewApplicants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bulkReviewSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { adminBulkReview } = await import("./portal-actions.server");
    return adminBulkReview(context.userId, data);
  });

export const setEmploymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => employmentSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { adminSetEmployment } = await import("./portal-actions.server");
    return adminSetEmployment(context.userId, data);
  });

export const adminReplyToApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ applicantId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { adminSendMessage } = await import("./portal-actions.server");
    return adminSendMessage(context.userId, data);
  });

export const adminMessageInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminInbox } = await import("./portal-actions.server");
    return adminInbox(context.userId);
  });

export const adminMarkMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminMarkInboxRead } = await import("./portal-actions.server");
    return adminMarkInboxRead(context.userId);
  });

export const sendMessageToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => messageSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { sendUserMessage } = await import("./portal-actions.server");
    return sendUserMessage(context.userId, data.body);
  });

export const submitApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { submitApplication } = await import("./portal-actions.server");
    return submitApplication(context.userId);
  });

/* ---------------- Login protection & password recovery ---------------- */

const emailSchema = z.object({ email: z.string().trim().email().max(255) });

export const checkLoginAllowed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const { assertNotLocked } = await import("./portal-auth.server");
    return assertNotLocked(data.email);
  });

export const reportLoginResult = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.extend({ success: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { recordLoginResult } = await import("./portal-auth.server");
    return recordLoginResult(data.email, data.success);
  });

export const fetchSecurityQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const { getSecurityQuestion } = await import("./portal-auth.server");
    return getSecurityQuestion(data.email);
  });

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        answer: z.string().trim().min(1).max(120),
        newPassword: z.string().min(8).max(72),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { resetPasswordWithAnswer } = await import("./portal-auth.server");
    return resetPasswordWithAnswer(data);
  });

/* ---------------- Settings ---------------- */

export const updateSecurityQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        question: z.string().trim().min(5).max(200),
        answer: z.string().trim().min(2).max(120),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveSecurityQuestion } = await import("./portal-auth.server");
    return saveSecurityQuestion(context.userId, data.question, data.answer);
  });

export const updatePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ newPassword: z.string().min(8).max(72) }).parse(data))
  .handler(async ({ context, data }) => {
    const { changePassword } = await import("./portal-auth.server");
    return changePassword(context.userId, data.newPassword);
  });

/* ---------------- Application period ---------------- */

export const fetchApplicationPeriod = createServerFn({ method: "GET" }).handler(async () => {
  const { getApplicationPeriod } = await import("./portal-auth.server");
  return getApplicationPeriod();
});

export const saveApplicationPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        deadline: z.string().min(4).max(40).optional(),
        manuallyClosed: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden: admin access required");
    const { setApplicationPeriod } = await import("./portal-auth.server");
    return setApplicationPeriod(data);
  });

/* ---------------- Document verification ---------------- */

export const verifyUploadedDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { verifyDocument } = await import("./document-verify.server");
    return verifyDocument(context.userId, data.documentId);
  });

/* ---------------- Research assistant ---------------- */

export const assistantThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listThreads } = await import("./assistant.server");
    return listThreads(context.userId);
  });

export const assistantThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ threadId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { threadMessages } = await import("./assistant.server");
    return threadMessages(context.userId, data.threadId);
  });

export const assistantDeleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ threadId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { deleteThread } = await import("./assistant.server");
    return deleteThread(context.userId, data.threadId);
  });

export const assistantAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        threadId: z.string().uuid().nullable().optional(),
        message: z.string().trim().min(1).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { askAssistant } = await import("./assistant.server");
    return askAssistant(context.userId, data);
  });
