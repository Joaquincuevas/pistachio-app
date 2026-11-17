import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envío de correo por SMTP, sin servicios de pago: basta una casilla existente
 * (ej. Gmail con "contraseña de aplicación"). Configuración por variables de
 * entorno; si faltan, en desarrollo se imprime el link en consola.
 *
 *   SMTP_HOST   (def. smtp.gmail.com)
 *   SMTP_PORT   (def. 465)
 *   SMTP_USER   correo remitente (ej. tucuenta@gmail.com)
 *   SMTP_PASS   contraseña de aplicación de ese correo
 *   SMTP_FROM   (opcional) remitente visible, def. "Pistachio <SMTP_USER>"
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465, // 465 = SSL directo; 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/** ¿Hay SMTP configurado? (para avisar en producción si falta). */
export function mailerConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    // Sin SMTP (desarrollo): el link queda en la consola del servidor.
    console.log(`[mailer] (sin SMTP) link de recuperación para ${to}:\n  ${link}`);
    return;
  }
  const from = process.env.SMTP_FROM ?? `Pistachio <${process.env.SMTP_USER}>`;
  await tx.sendMail({
    from,
    to,
    subject: 'Recupera tu contraseña de Pistachio',
    text:
      `Recibimos una solicitud para restablecer tu contraseña de Pistachio.\n\n` +
      `Abre este enlace para crear una nueva (expira en 1 hora):\n${link}\n\n` +
      `Si no fuiste tú, ignora este correo: tu contraseña no cambia.`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1c1c1a">
        <h2 style="font-size:18px;margin:0 0 12px">Recupera tu contraseña</h2>
        <p style="font-size:14px;line-height:1.5;color:#4a4a45">
          Recibimos una solicitud para restablecer tu contraseña de <strong>Pistachio</strong>.
          El enlace expira en 1 hora.
        </p>
        <p style="margin:22px 0">
          <a href="${link}" style="background:#4A7C59;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block">
            Crear nueva contraseña
          </a>
        </p>
        <p style="font-size:12px;line-height:1.5;color:#9c9c96">
          Si el botón no funciona, copia y pega este enlace:<br>
          <span style="word-break:break-all">${link}</span>
        </p>
        <p style="font-size:12px;line-height:1.5;color:#9c9c96">
          Si no fuiste tú, ignora este correo: tu contraseña no cambia.
        </p>
      </div>`,
  });
}

/** Escapa texto del usuario antes de meterlo en el HTML del correo. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Feedback anónimo de los alumnos. Se envía a FEEDBACK_TO (o, si falta, a la
 * misma casilla SMTP_USER). Nunca incluye nombre, correo ni id de quien escribe.
 */
export async function sendFeedbackEmail(title: string, message: string): Promise<void> {
  const to = process.env.FEEDBACK_TO ?? process.env.SMTP_USER;
  const tx = getTransporter();
  if (!tx || !to) {
    console.log(`[mailer] (sin SMTP) feedback anónimo:\n  ${title}\n  ${message}`);
    return;
  }
  const from = process.env.SMTP_FROM ?? `Pistachio <${process.env.SMTP_USER}>`;
  const date = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  await tx.sendMail({
    from,
    to,
    subject: `Feedback Pistachio: ${title.replace(/[\r\n]+/g, ' ')}`,
    text: `${title}\n\n${message}\n\n— Enviado de forma anónima desde Pistachio (${date})`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1a">
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4A7C59;margin:0 0 8px">Feedback anónimo</p>
        <h2 style="font-size:18px;margin:0 0 14px">${escapeHtml(title)}</h2>
        <p style="font-size:14px;line-height:1.6;color:#33332f;white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
        <p style="font-size:12px;color:#9c9c96;margin-top:24px">Enviado desde Pistachio · ${date}</p>
      </div>`,
  });
}
