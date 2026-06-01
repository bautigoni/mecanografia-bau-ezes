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

  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Te invitaron a Typely ✨",
      html: `
        <div style="font-family:system-ui,sans-serif;color:#17355f">
          <h2>¡Hola${name ? ` ${name}` : ""}!</h2>
          <p>Te invitaron a Typely como <b>${role || "docente"}</b>.</p>
          <p><a href="${link}" style="background:#6f63ff;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Aceptar invitación</a></p>
          <p style="color:#61709e;font-size:13px">O copiá este enlace: ${link}</p>
        </div>`,
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
