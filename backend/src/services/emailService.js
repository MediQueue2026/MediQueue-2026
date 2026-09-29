import nodemailer from 'nodemailer';

/**
 * MediQueue Email Dispatcher
 * Supports:
 * 1. Resend API (via RESEND_API_KEY)
 * 2. SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 3. Local Dev Fallback (Logs email & direct reset link to console for rapid testing)
 */

let smtpTransporter = null;

function getTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    smtpTransporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user, pass },
    });
    return smtpTransporter;
  }
  return null;
}

export async function sendPasswordResetEmail({ to, resetUrl, userName }) {
  const fromEmail = process.env.FROM_EMAIL || 'MediQueue Security <no-reply@mediqueue.lk>';
  const subject = 'Reset Your MediQueue Password';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 580px; margin: 30px auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(16, 185, 129, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .header { background: linear-gradient(135deg, #042f2e 0%, #0f766e 50%, #4f46e5 100%); padding: 28px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; color: #ffffff; letter-spacing: -0.02em; font-weight: 800; }
        .content { padding: 32px 28px; color: #cbd5e1; line-height: 1.6; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #0d9488 50%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); }
        .footer { padding: 20px 28px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }
        .token-box { background: #0f172a; border: 1px dashed #475569; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MediQueue Security</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${userName || 'MediQueue User'}</strong>,</p>
          <p>We received a request to reset your password for your MediQueue account. Click the button below to set a new password:</p>
          <div class="btn-container">
            <a href="${resetUrl}" class="btn">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #94a3b8;">This reset link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
          <div class="token-box">
            Alternative link: ${resetUrl}
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} MediQueue Healthcare System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Resend API Check
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });
      if (response.ok) {
        console.log(`[Email] Password reset email sent via Resend to ${to}`);
        return { success: true, provider: 'resend' };
      }
      const errData = await response.json();
      console.warn('[Email] Resend API error:', errData);
    } catch (err) {
      console.error('[Email] Failed to send via Resend:', err.message);
    }
  }

  // 2. SMTP Check
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
      });
      console.log(`[Email] Password reset email sent via SMTP to ${to}`);
      return { success: true, provider: 'smtp' };
    } catch (err) {
      console.error('[Email] Failed to send via SMTP:', err.message);
    }
  }

  // 3. Dev Mode Console Fallback
  console.log('──────────────────────────────────────────────────────────────────');
  console.log(`[DEV MODE EMAIL FALLBACK] Password Reset Requested for: ${to}`);
  console.log(`[DEV MODE EMAIL FALLBACK] Direct Reset URL: ${resetUrl}`);
  console.log('──────────────────────────────────────────────────────────────────');

  return { success: true, provider: 'dev_fallback', resetUrl };
}
