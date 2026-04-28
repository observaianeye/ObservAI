/**
 * Yan #10: password reset email is locale-aware. These tests pin the
 * subject + HTML body language switch via the `locale` parameter.
 *
 * No SMTP env is configured in test, so sendPasswordResetEmail returns
 * { success: false } before reaching nodemailer. We instead verify the
 * exported PASSWORD_RESET_TEMPLATES contract directly so a future
 * refactor can't silently regress the strings.
 */
import { describe, it, expect } from 'vitest';
import { PASSWORD_RESET_TEMPLATES } from '../services/emailService';

describe('Yan #10 — password reset email locale templates', () => {
  it('TR template uses Turkish subject and body strings', () => {
    const t = PASSWORD_RESET_TEMPLATES.tr;
    expect(t.subject).toMatch(/Sifre Sifirlama/);
    expect(t.subject).toMatch(/ObservAI/);
    expect(t.headerTitle).toMatch(/Sifre Sifirlama/);
    expect(t.cta).toMatch(/Sifirla/);
    expect(t.greetingNamed('Ada')).toMatch(/Merhaba/);
    expect(t.greetingAnon).toMatch(/Merhaba/);
    expect(t.bodyP1).toMatch(/sifre sifirlama/i);
    expect(t.expiryNote).toMatch(/1 saat/);
    // No EN fragments leak into TR template
    expect(t.subject.toLowerCase()).not.toMatch(/password reset/);
  });

  it('EN template uses English subject and body strings', () => {
    const t = PASSWORD_RESET_TEMPLATES.en;
    expect(t.subject).toMatch(/Password Reset Request/);
    expect(t.subject).toMatch(/ObservAI/);
    expect(t.headerTitle).toMatch(/Password Reset/);
    expect(t.cta).toMatch(/Reset Password/);
    expect(t.greetingNamed('Ada')).toMatch(/Hello/);
    expect(t.greetingAnon).toMatch(/Hello/);
    expect(t.bodyP1).toMatch(/password reset request/i);
    expect(t.expiryNote).toMatch(/1 hour/);
    // No TR fragments leak into EN template
    expect(t.subject.toLowerCase()).not.toMatch(/sifirlama/);
  });
});
