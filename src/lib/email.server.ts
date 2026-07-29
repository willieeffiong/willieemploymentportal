import { sendLovableEmail } from "@lovable.dev/email-js";

export const ADMIN_EMAIL = "willieeffiong52@gmail.com";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2a20">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#1b5e20;color:#ffffff;padding:18px 24px;border-radius:10px 10px 0 0">
      <h1 style="margin:0;font-size:20px">WILLIE LAB TECH</h1>
    </div>
    <div style="border:1px solid #e3e8e3;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#1b5e20">${escapeHtml(title)}</h2>
      ${body}
      <p style="margin-top:24px;font-size:12px;color:#6b7a6c">Willie Lab Tech Empowerment Portal</p>
    </div>
  </div></body></html>`;
}

export interface MailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Sends a portal email through Lovable's managed email API.
 * Returns { sent:false } (never throws) when no sender domain is configured yet.
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  title: string;
  bodyHtml: string;
  text: string;
  idempotencyKey?: string;
}): Promise<MailResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.SENDER_DOMAIN;
  const fromDomain = process.env.FROM_DOMAIN || senderDomain;

  if (!apiKey || !senderDomain || !fromDomain) {
    console.warn("[email] Sender domain not configured yet — skipping send to", options.to);
    return { sent: false, reason: "email_not_configured" };
  }

  try {
    await sendLovableEmail(
      {
        to: options.to,
        from: `Willie Lab Tech <notifications@${fromDomain}>`,
        sender_domain: senderDomain,
        subject: options.subject,
        html: wrap(options.title, options.bodyHtml),
        text: options.text,
        purpose: "transactional",
      },
      { apiKey, idempotencyKey: options.idempotencyKey },
    );
    return { sent: true };
  } catch (error) {
    console.error("[email] send failed", error);
    return { sent: false, reason: "send_failed" };
  }
}

export function otpEmail(code: string) {
  return {
    subject: "Your WILLIE LAB TECH verification code",
    title: "Verify your account",
    bodyHtml: `<p style="margin:0 0 12px">Use the code below to verify your Willie Lab Tech account. It expires in 15 minutes.</p>
      <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#f57c00;margin:16px 0">${code}</p>`,
    text: `Your Willie Lab Tech verification code is ${code}. It expires in 15 minutes.`,
  };
}
