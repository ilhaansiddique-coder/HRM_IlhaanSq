import nodemailer from "nodemailer";

// ─── SMTP Transporter Singleton ─────────────────────────────
// Reuses one connection pool across requests. Configurable via env vars.
//
// Required env (set in .env):
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=your-app-password
//   SMTP_FROM_ADDRESS=noreply@rahedeen.com
//   SMTP_FROM_NAME="RaheDeen Inventory"
//
// If SMTP_HOST isn't set, emails are logged to console (dev mode).

const globalForMail = globalThis as unknown as {
  mailer: nodemailer.Transporter | null;
};

function getTransporter(): nodemailer.Transporter | null {
  if (globalForMail.mailer !== undefined) return globalForMail.mailer;

  const host = process.env.SMTP_HOST;
  if (!host) {
    globalForMail.mailer = null;
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  globalForMail.mailer = transporter;
  return transporter;
}

// ─── Send Email ─────────────────────────────────────────────

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || "RaheDeen Inventory";
  const fromAddress = process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER;

  if (!transporter || !fromAddress) {
    console.warn(
      `[email] SMTP not configured. Email NOT sent.\n  To: ${input.to}\n  Subject: ${input.subject}\n  Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable real delivery.`
    );
    return { delivered: false, reason: "SMTP not configured" };
  }

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
    });
    return { delivered: true };
  } catch (error) {
    console.error("[email] Send failed:", error);
    return {
      delivered: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Templates ──────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #f1f1f3;">
                <div style="display:inline-flex;align-items:center;gap:8px;">
                  <div style="width:32px;height:32px;background:#1f5d47;border-radius:8px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;">R</div>
                  <span style="font-size:16px;font-weight:600;color:#0f172a;">RaheDeen Inventory</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#0f172a;line-height:1.6;font-size:15px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background:#fafafa;border-top:1px solid #f1f1f3;font-size:12px;color:#71717a;text-align:center;">
                You're receiving this email because you (or someone) requested access to RaheDeen Inventory.<br />
                If this wasn't you, ignore this email or contact <a href="mailto:support@rahedeen.com" style="color:#1f5d47;">support</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendApprovalEmail(input: {
  to: string;
  fullName: string;
  businessName: string;
  tempPassword: string;
}) {
  const loginUrl = `${APP_URL}/login`;

  const html = emailLayout(`
    <h1 style="font-size:22px;margin:0 0 16px 0;font-weight:bold;">Welcome to RaheDeen, ${escapeHtml(input.fullName)}!</h1>
    <p>Great news — your access request for <strong>${escapeHtml(input.businessName)}</strong> has been approved.</p>
    <p>Here are your temporary login credentials:</p>
    <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Email</p>
      <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;font-family:monospace;">${escapeHtml(input.to)}</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Temporary password</p>
      <p style="margin:0;font-size:18px;font-weight:bold;font-family:monospace;letter-spacing:1px;color:#1f5d47;">${escapeHtml(input.tempPassword)}</p>
    </div>
    <p style="margin:24px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#1f5d47;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Sign in to your dashboard →</a>
    </p>
    <p style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;font-size:13px;color:#713f12;margin:20px 0;">
      <strong>⚠ Important:</strong> For your security, you'll be required to set a new password on your first sign-in. Choose something only you would know.
    </p>
    <p style="margin-top:24px;color:#71717a;font-size:13px;">
      Need help? Just reply to this email — we read every message.
    </p>
  `);

  return sendEmail({
    to: input.to,
    subject: `Welcome to RaheDeen — your workspace is ready`,
    html,
  });
}

export async function sendEmployeeOnboardingEmail(input: {
  to: string;
  fullName: string;
  businessName: string;
  verifyUrl: string;
}) {
  const html = emailLayout(`
    <h1 style="font-size:22px;margin:0 0 16px 0;font-weight:bold;">Welcome aboard, ${escapeHtml(input.fullName)}!</h1>
    <p>Your employee profile at <strong>${escapeHtml(input.businessName)}</strong> has been approved.</p>
    <p>To activate your account, verify this email address and set your password:</p>
    <p style="margin:24px 0;">
      <a href="${input.verifyUrl}" style="display:inline-block;background:#1f5d47;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Verify email &amp; set password →</a>
    </p>
    <p style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;font-size:13px;color:#713f12;margin:20px 0;">
      You can only sign in after verifying this email. The link expires in 7 days.
    </p>
    <p style="font-size:12px;color:#a1a1aa;margin-top:24px;">If the button doesn't work, copy this URL into your browser:<br /><span style="font-family:monospace;word-break:break-all;color:#71717a;">${escapeHtml(input.verifyUrl)}</span></p>
  `);

  return sendEmail({
    to: input.to,
    subject: `Activate your ${input.businessName} employee account`,
    html,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  fullName: string;
  resetUrl: string;
}) {
  const html = emailLayout(`
    <h1 style="font-size:22px;margin:0 0 16px 0;font-weight:bold;">Reset your password</h1>
    <p>Hi ${escapeHtml(input.fullName)},</p>
    <p>We received a request to reset the password for your RaheDeen Inventory account. Click the button below to choose a new password:</p>
    <p style="margin:24px 0;">
      <a href="${input.resetUrl}" style="display:inline-block;background:#1f5d47;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Reset password →</a>
    </p>
    <p style="font-size:13px;color:#71717a;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't be changed.</p>
    <p style="font-size:12px;color:#a1a1aa;margin-top:24px;">If the button doesn't work, copy and paste this URL into your browser:<br /><span style="font-family:monospace;word-break:break-all;color:#71717a;">${escapeHtml(input.resetUrl)}</span></p>
  `);

  return sendEmail({
    to: input.to,
    subject: "Reset your RaheDeen password",
    html,
  });
}

export async function sendApplicationNotification(input: {
  to: string;
  applicantName: string;
  applicantEmail: string;
  jobTitle: string;
  tenantName: string;
  adminUrl: string;
  phone?: string;
  notes?: string;
}) {
  const html = emailLayout(`
    <h1 style="font-size:22px;margin:0 0 16px 0;font-weight:bold;">New Job Application</h1>
    <p>A new candidate has applied for <strong>${escapeHtml(input.jobTitle)}</strong> at ${escapeHtml(input.tenantName)}.</p>
    <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Applicant</p>
      <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;">${escapeHtml(input.applicantName)}</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Email</p>
      <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;">${escapeHtml(input.applicantEmail)}</p>
      ${input.phone ? `<p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Phone</p><p style="margin:0 0 16px 0;font-size:15px;font-weight:600;">${escapeHtml(input.phone)}</p>` : ""}
      ${input.notes ? `<p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Notes</p><p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;">${escapeHtml(input.notes)}</p>` : ""}
    </div>
    <p style="margin:24px 0;">
      <a href="${input.adminUrl}" style="display:inline-block;background:#1f5d47;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Review in Dashboard →</a>
    </p>
    <p style="color:#71717a;font-size:13px;">
      You can manage this application from the recruitment pipeline in your admin dashboard.
    </p>
  `);

  return sendEmail({
    to: input.to,
    subject: `New application for ${input.jobTitle} — ${input.applicantName}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
