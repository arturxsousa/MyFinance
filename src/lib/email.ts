import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "My Finance <noreply@myfinance.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function send(to: string, subject: string, html: string) {
  return resend.emails.send({ from: FROM, to, subject, html });
}

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#059669;padding:24px 32px;text-align:center;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">My Finance</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${body}
            <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
              If you did not request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function primaryButton(href: string, label: string) {
  return `<p style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">${label}</a>
  </p>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const html = baseTemplate(
    "Verify your email — My Finance",
    `<h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Verify your email address</h2>
     <p style="margin:0 0 4px;color:#4b5563;font-size:15px;line-height:1.6;">Click the button below to confirm your email. This link expires in <strong>24 hours</strong>.</p>
     ${primaryButton(link, "Verify email")}
     <p style="color:#9ca3af;font-size:12px;text-align:center;">Or copy this link:<br><a href="${link}" style="color:#059669;word-break:break-all;">${link}</a></p>`
  );
  return send(to, "Verify your email — My Finance", html);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = baseTemplate(
    "Reset your password — My Finance",
    `<h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Reset your password</h2>
     <p style="margin:0 0 4px;color:#4b5563;font-size:15px;line-height:1.6;">We received a request to reset your password. Click the button below — the link expires in <strong>1 hour</strong>.</p>
     ${primaryButton(link, "Reset password")}
     <p style="color:#9ca3af;font-size:12px;text-align:center;">Or copy this link:<br><a href="${link}" style="color:#059669;word-break:break-all;">${link}</a></p>`
  );
  return send(to, "Reset your password — My Finance", html);
}
