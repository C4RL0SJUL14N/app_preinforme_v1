import nodemailer from 'nodemailer';
import { config } from './config.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createGmailTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmailSmtpUser,
      pass: config.gmailAppPassword
    },
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

export async function sendPasswordResetEmail({ email, teacherName, resetUrl, expiresInMinutes }) {
  try {
    await createGmailTransport().sendMail({
      from: config.passwordResetEmailFrom || `Preinformes <${config.gmailSmtpUser}>`,
      to: email,
      subject: 'Recuperación de contraseña - Preinformes',
      text: `Hola ${teacherName}. Para cambiar tu contraseña abre este enlace: ${resetUrl}. El enlace vence en ${expiresInMinutes} minutos y solo puede utilizarse una vez.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
          <h2>Recuperación de contraseña</h2>
          <p>Hola ${escapeHtml(teacherName)}.</p>
          <p>Recibimos una solicitud para cambiar tu contraseña de Preinformes.</p>
          <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px">Cambiar contraseña</a></p>
          <p>Este enlace vence en ${expiresInMinutes} minutos y solo puede utilizarse una vez.</p>
          <p>Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>
        </div>
      `
    });
  } catch (smtpError) {
    console.error('Gmail SMTP password recovery error:', smtpError.code || smtpError.message);
    const error = new Error('No fue posible enviar el correo de recuperación');
    error.statusCode = 502;
    throw error;
  }
}
