import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

const verifySchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().regex(/^\d{6}$/),
});

const emailSchema = z.object({ email: z.string().trim().email().max(255) });

const reviewSchema = z.object({
  applicantId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(1000).optional(),
});

export const registerApplicant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { register } = await import("./portal-actions.server");
    return register(data);
  });

export const verifyAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const { verify } = await import("./portal-actions.server");
    return verify(data);
  });

export const resendCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const { resend } = await import("./portal-actions.server");
    return resend(data.email);
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

export const submitApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { submitApplication } = await import("./portal-actions.server");
    return submitApplication(context.userId);
  });
