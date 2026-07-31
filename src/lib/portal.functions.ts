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
