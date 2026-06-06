/* =====================================================================
 * emailService — frontend side of the invitation email flow.
 *
 * SECURITY: the frontend NEVER talks to Resend (or any email provider)
 * directly and NEVER holds an API key. It calls an internal backend
 * endpoint which keeps RESEND_API_KEY server-side only (see /server).
 *
 * The endpoint is configurable via VITE_INVITE_API_URL and defaults to a
 * same-origin relative path so it works behind the reverse proxy. If the
 * backend is not deployed yet, sending fails gracefully and the caller
 * keeps the invitation as "pending" + shows a copyable link instead.
 * ===================================================================== */

import type { Invitation, Role } from "../types";
import { buildInvitationLink, getSiteById } from "./storage";

/* Friendly Spanish labels so the email reads "Docente" / "Admin de sede"
   instead of the internal role ids ("profesor" / "admin-sede"). */
const ROLE_LABELS: Partial<Record<Role, string>> = {
  profesor: "Docente",
  "admin-sede": "Admin de sede",
  "admin-general": "Admin general",
  superadmin: "Superadmin",
  alumno: "Alumno",
};

const ENDPOINT =
  (import.meta.env.VITE_INVITE_API_URL as string | undefined)?.trim() ||
  "/api/invitations/send";

export interface SendResult {
  ok: boolean;
  /** Why it failed (for the UI). */
  reason?: "NETWORK" | "SERVER" | "NOT_CONFIGURED";
  /** Always returned so the UI can offer "copy link" as a fallback. */
  link: string;
}

/** Asks the backend to email an invitation. Returns a structured result;
 *  it never throws, so the UI can always fall back to a shareable link. */
export async function sendInvitationEmail(invitation: Invitation): Promise<SendResult> {
  const link = buildInvitationLink(invitation.token);

  // Only the public, non-sensitive fields are sent to our own backend.
  const school = invitation.siteId ? getSiteById(invitation.siteId)?.name : undefined;
  const payload = {
    email: invitation.email,
    name: invitation.name,
    role: ROLE_LABELS[invitation.role] ?? invitation.role,
    school,
    token: invitation.token,
    link,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, link };
    // 404 → endpoint not deployed yet in this environment.
    return { ok: false, reason: res.status === 404 ? "NOT_CONFIGURED" : "SERVER", link };
  } catch {
    return { ok: false, reason: "NETWORK", link };
  }
}
