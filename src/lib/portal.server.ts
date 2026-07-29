export const ADMIN_EMAIL = "willieeffiong52@gmail.com";
export const ADMIN_PASSWORD = "willie44?";

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function otpExpiry(): string {
  return new Date(Date.now() + 15 * 60 * 1000).toISOString();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
