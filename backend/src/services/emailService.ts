/**
 * Email Notification Service
 *
 * Sends alert and daily summary emails via Nodemailer (SMTP).
 *
 * Setup:
 *   1. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM in backend/.env
 *   2. Gmail: use App Password (not regular password)
 *   3. Daily summary requires dailySummaryEnabled + dailySummaryTime on User
 */

import nodemailer from 'nodemailer';

// Severity colors for HTML emails
const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6',
};

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '\u{1F534}',
  high: '\u{1F7E0}',
  medium: '\u{1F7E1}',
  low: '\u{1F535}',
};

interface EmailSendResult {
  success: boolean;
  error?: string;
}

/**
 * Create a reusable SMTP transporter.
 * Returns null if SMTP is not configured.
 */
function createTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Send an alert email.
 */
export async function sendAlertEmail(
  to: string,
  title: string,
  message: string,
  severity: string,
  cameraName?: string
): Promise<EmailSendResult> {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@observai.com';
  const color = SEVERITY_COLOR[severity] || '#6B7280';
  const emoji = SEVERITY_EMOJI[severity] || '';
  const timestamp = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#1a1a24;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">
    <div style="background:${color};padding:16px 24px;">
      <h2 style="margin:0;color:#fff;font-size:16px;">${emoji} ObservAI Alert &mdash; ${severity.toUpperCase()}</h2>
    </div>
    <div style="padding:24px;">
      <h3 style="margin:0 0 8px;color:#e5e5e5;font-size:15px;">${title}</h3>
      <p style="margin:0 0 16px;color:#a0a0b0;font-size:14px;line-height:1.5;">${message}</p>
      ${cameraName ? `<p style="margin:0 0 8px;color:#888;font-size:13px;">&#x1F4F7; Kamera: ${cameraName}</p>` : ''}
      <p style="margin:0;color:#666;font-size:12px;">&#x1F552; ${timestamp}</p>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #2a2a3a;text-align:center;">
      <span style="color:#555;font-size:11px;">ObservAI &mdash; Real-time Cafe Analytics</span>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `${emoji} [ObservAI] ${severity.toUpperCase()}: ${title}`,
      html,
    });
    console.log(`[Email] Alert sent to ${to}: ${title}`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Send failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Send a daily summary email.
 */
export async function sendDailySummaryEmail(
  to: string,
  summary: {
    totalVisitors: number;
    avgOccupancy: number;
    peakHour: string;
    genderSplit: string;
    dominantAge: string;
    alertCount: { critical: number; high: number; medium: number; low: number };
    recommendations: string[];
    date: string;
  }
): Promise<EmailSendResult> {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@observai.com';
  const totalAlerts = summary.alertCount.critical + summary.alertCount.high + summary.alertCount.medium + summary.alertCount.low;

  const recsHtml = summary.recommendations.length > 0
    ? summary.recommendations.map((r, i) => `<li style="color:#a0a0b0;margin:4px 0;font-size:13px;">${i + 1}. ${r}</li>`).join('')
    : '<li style="color:#666;font-size:13px;">Oneri uretmek icin Ollama aktif olmali.</li>';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#1a1a24;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">
    <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:20px 24px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">&#x1F4CA; ObservAI &mdash; Gunluk Ozet</h2>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">${summary.date}</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Toplam Ziyaretci</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:15px;font-weight:bold;text-align:right;">${summary.totalVisitors}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">Ort. Doluluk</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:15px;font-weight:bold;text-align:right;border-top:1px solid #2a2a3a;">${summary.avgOccupancy}%</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">Peak Saat</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:15px;font-weight:bold;text-align:right;border-top:1px solid #2a2a3a;">${summary.peakHour}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">Cinsiyet</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:13px;text-align:right;border-top:1px solid #2a2a3a;">${summary.genderSplit}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">Baskin Yas Grubu</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:13px;text-align:right;border-top:1px solid #2a2a3a;">${summary.dominantAge}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">Alert Sayisi</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:13px;text-align:right;border-top:1px solid #2a2a3a;">
            &#x1F534;${summary.alertCount.critical} &#x1F7E0;${summary.alertCount.high} &#x1F7E1;${summary.alertCount.medium} &#x1F535;${summary.alertCount.low} (${totalAlerts})
          </td>
        </tr>
      </table>
      <h4 style="margin:16px 0 8px;color:#c084fc;font-size:14px;">&#x1F4A1; AI Onerileri</h4>
      <ul style="margin:0;padding-left:18px;">${recsHtml}</ul>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #2a2a3a;text-align:center;">
      <span style="color:#555;font-size:11px;">ObservAI &mdash; Real-time Cafe Analytics</span>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `\u{1F4CA} [ObservAI] Gunluk Ozet - ${summary.date}`,
      html,
    });
    console.log(`[Email] Daily summary sent to ${to}`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Summary send failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Send a staff shift assignment email.
 */
export async function sendStaffShiftEmail(
  to: string,
  payload: {
    staffName: string;
    branchName: string;
    date: string;
    shiftStart: string;
    shiftEnd: string;
    role?: string;
    acceptUrl?: string;
    declineUrl?: string;
  }
): Promise<EmailSendResult> {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@observai.com';

  const actionsHtml = payload.acceptUrl || payload.declineUrl
    ? `<div style="padding:16px 24px;text-align:center;border-top:1px solid #2a2a3a;">
        ${payload.acceptUrl ? `<a href="${payload.acceptUrl}" style="display:inline-block;padding:10px 20px;margin:0 6px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Vardiyayi Onayla</a>` : ''}
        ${payload.declineUrl ? `<a href="${payload.declineUrl}" style="display:inline-block;padding:10px 20px;margin:0 6px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Reddet</a>` : ''}
       </div>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#1a1a24;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">
    <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:20px 24px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">&#x1F4C5; Yeni Vardiya Atamasi</h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#e5e5e5;font-size:14px;">Merhaba <strong>${payload.staffName}</strong>,</p>
      <p style="margin:0 0 16px;color:#a0a0b0;font-size:14px;line-height:1.5;">Asagidaki vardiya icin sizinle iletisime geciyoruz:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;background:#141420;border-radius:8px;">
        <tr>
          <td style="padding:10px 14px;color:#888;font-size:13px;">&#x1F3EA; Sube</td>
          <td style="padding:10px 14px;color:#e5e5e5;font-size:14px;text-align:right;font-weight:bold;">${payload.branchName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">&#x1F4C6; Tarih</td>
          <td style="padding:10px 14px;color:#e5e5e5;font-size:14px;text-align:right;border-top:1px solid #2a2a3a;">${payload.date}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">&#x1F552; Saat</td>
          <td style="padding:10px 14px;color:#e5e5e5;font-size:14px;text-align:right;border-top:1px solid #2a2a3a;">${payload.shiftStart} - ${payload.shiftEnd}</td>
        </tr>
        ${payload.role ? `<tr>
          <td style="padding:10px 14px;color:#888;font-size:13px;border-top:1px solid #2a2a3a;">&#x1F464; Gorev</td>
          <td style="padding:10px 14px;color:#e5e5e5;font-size:14px;text-align:right;border-top:1px solid #2a2a3a;">${payload.role}</td>
        </tr>` : ''}
      </table>
    </div>
    ${actionsHtml}
    <div style="padding:12px 24px;border-top:1px solid #2a2a3a;text-align:center;">
      <span style="color:#555;font-size:11px;">ObservAI &mdash; Personel Yonetimi</span>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `\u{1F4C5} [ObservAI] Vardiya: ${payload.date} ${payload.shiftStart}-${payload.shiftEnd}`,
      html,
    });
    console.log(`[Email:Staff] Shift email sent to ${to} (${payload.staffName})`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Email:Staff] Send failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Yan #10: password reset emails were TR-only. Now locale-aware.
 * Caller passes 'tr' | 'en' (defaulting to 'tr' to preserve old behaviour).
 */
export type EmailLocale = 'tr' | 'en';

interface PasswordResetTemplate {
  subject: string;
  headerTitle: string;
  greetingNamed: (name: string) => string;
  greetingAnon: string;
  bodyP1: string;
  cta: string;
  fallbackHint: string;
  expiryNote: string;
  footer: string;
}

export const PASSWORD_RESET_TEMPLATES: Record<EmailLocale, PasswordResetTemplate> = {
  tr: {
    subject: '\u{1F511} [ObservAI] Sifre Sifirlama Talebi',
    headerTitle: 'Sifre Sifirlama',
    greetingNamed: (name) => `Merhaba <strong>${name}</strong>,`,
    greetingAnon: 'Merhaba,',
    bodyP1: 'ObservAI hesabiniz icin sifre sifirlama talebi aldik. Yeni bir sifre belirlemek icin asagidaki butona tiklayin:',
    cta: 'Sifreyi Sifirla',
    fallbackHint: 'Buton calismazsa bu baglantiyi tarayicinizda acin:',
    expiryNote: 'Bu baglanti 1 saat sonra gecerliligini yitirir. Eger bu istegi siz yapmadiysaniz e-postayi gormezden gelin; sifreniz degismeyecek.',
    footer: 'ObservAI &mdash; Real-time Cafe Analytics',
  },
  en: {
    subject: '\u{1F511} [ObservAI] Password Reset Request',
    headerTitle: 'Password Reset',
    greetingNamed: (name) => `Hello <strong>${name}</strong>,`,
    greetingAnon: 'Hello,',
    bodyP1: 'We received a password reset request for your ObservAI account. Click the button below to set a new password:',
    cta: 'Reset Password',
    fallbackHint: 'If the button does not work, open this link in your browser:',
    expiryNote: 'This link expires in 1 hour. If you did not request a reset, ignore this email — your password will not change.',
    footer: 'ObservAI &mdash; Real-time Cafe Analytics',
  },
};

/**
 * Send a password reset email.
 *
 * The link is good for 1 hour and single-use; the auth route is responsible
 * for token bookkeeping. Locale defaults to 'tr' for backwards compat.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName?: string,
  locale: EmailLocale = 'tr',
): Promise<EmailSendResult> {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@observai.com';
  const tpl = PASSWORD_RESET_TEMPLATES[locale] ?? PASSWORD_RESET_TEMPLATES.tr;
  const greeting = userName ? tpl.greetingNamed(userName) : tpl.greetingAnon;

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#1a1a24;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">
    <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:20px 24px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">&#x1F511; ${tpl.headerTitle}</h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#e5e5e5;font-size:14px;">${greeting}</p>
      <p style="margin:0 0 16px;color:#a0a0b0;font-size:14px;line-height:1.5;">
        ${tpl.bodyP1}
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${tpl.cta}</a>
      </div>
      <p style="margin:0 0 8px;color:#888;font-size:13px;">${tpl.fallbackHint}</p>
      <p style="margin:0 0 16px;word-break:break-all;color:#7c3aed;font-size:12px;">${resetUrl}</p>
      <p style="margin:0;color:#888;font-size:12px;">${tpl.expiryNote}</p>
    </div>
    <div style="padding:12px 24px;border-top:1px solid #2a2a3a;text-align:center;">
      <span style="color:#555;font-size:11px;">${tpl.footer}</span>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: tpl.subject,
      html,
    });
    console.log(`[Email] Password reset sent to ${to} (${locale})`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Password reset send failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Verify SMTP connection is working.
 */
export async function verifySmtp(): Promise<{ configured: boolean; connected: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    return { configured: false, connected: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.verify();
    return { configured: true, connected: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { configured: true, connected: false, error: errMsg };
  }
}
