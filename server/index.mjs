/* =====================================================================
 * Typely invitation email backend (OPTIONAL scaffold).
 *
 * This tiny server exists ONLY to keep the email provider secret off the
 * frontend. The browser calls POST /api/invitations/send (same-origin via
 * your reverse proxy) and this server talks to Resend using RESEND_API_KEY,
 * which lives exclusively in the server environment.
 *
 * It is NOT part of the Vite build and is not required for the app to run
 * (the frontend falls back to a shareable invite link if this endpoint is
 * absent). Deploy it only when you want real email delivery.
 *
 * Setup:
 *   npm i express resend
 *   RESEND_API_KEY=re_xxx INVITE_FROM="Typely <no-reply@typely.bauhub.online>" \
 *     node server/index.mjs
 *
 * NEVER expose RESEND_API_KEY through a VITE_ variable — those are inlined
 * into the public browser bundle.
 * ===================================================================== */

import express from "express";
import { Resend } from "resend";

const PORT = process.env.PORT || 8787;
const RESEND_API_KEY = process.env.RESEND_API_KEY; // server-side ONLY
const FROM = process.env.INVITE_FROM || "Typely <no-reply@example.com>";

const app = express();
app.use(express.json());

app.post("/api/invitations/send", async (req, res) => {
  const { email, name, role, link } = req.body ?? {};
  if (!email || !link) {
    return res.status(400).json({ ok: false, error: "Missing email or link" });
  }
  if (!RESEND_API_KEY) {
    // Not configured — tell the frontend so it keeps the invite "pending".
    return res.status(503).json({ ok: false, error: "Email not configured" });
  }

  // Strip angle brackets from admin-entered fields so they can't inject markup.
  const safeName = name ? String(name).replace(/[<>]/g, "") : "";
  const safeRole = role ? String(role).replace(/[<>]/g, "") : "docente";

  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "✨ Te invitaron a TYPELY",
      html: `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#eef3ff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Aceptá tu invitación y empezá a enseñar entre las nubes ✨</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3ff;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(54,86,134,0.18);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:linear-gradient(135deg,#54e8c6,#25c8df,#536bff);padding:30px 24px;text-align:center;">
          <div style="font-size:30px;font-weight:800;letter-spacing:1px;color:#ffffff;">TYPELY ✨</div>
          <div style="color:rgba(255,255,255,0.92);font-size:14px;margin-top:6px;">Aprendé a escribir jugando entre las nubes</div>
        </td></tr>
        <tr><td style="padding:32px 30px 6px;">
          <h1 style="margin:0 0 10px;font-size:22px;color:#17355f;">¡Hola${safeName ? " " + safeName : ""}! 👋</h1>
          <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#4a5891;">Te invitaron a <strong>Typely</strong> como <strong>${safeRole}</strong>. Aceptá tu invitación y empezá a acompañar a tus alumnos en su aventura.</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 30px 6px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#54e8c6,#25c8df,#536bff);color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 40px;border-radius:999px;box-shadow:0 10px 22px rgba(83,107,255,0.35);">Acceder a Typely&nbsp;→</a>
        </td></tr>
        <tr><td style="padding:18px 30px 26px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8a93b3;text-align:center;">¿No funciona el botón? Copiá y pegá este enlace:<br><a href="${link}" style="color:#536bff;word-break:break-all;">${link}</a></p>
        </td></tr>
        <tr><td style="background:#f6f8ff;padding:16px 24px;text-align:center;border-top:1px solid #e6ebf7;">
          <div style="font-size:11px;color:#9aa3c0;">Entorno seguro para aprender y enseñar · TYPELY</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(502).json({ ok: false, error: "Email provider error" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Typely invite server listening on :${PORT}`);
});
