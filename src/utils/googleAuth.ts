/* =====================================================================
 * Google Identity Services helper.
 *
 * Frontend-only OAuth via Google Identity Services (GIS). We use the
 * *Client ID* exclusively — the Client SECRET must never appear in
 * frontend code or in this repository (it is only used by backends that
 * perform a server-side code exchange, which this app does not do).
 *
 * Public surface:
 *   getGoogleClientId()      → string | undefined
 *   getAllowedDomains()      → string[]
 *   parseJwtCredential(jwt)  → GoogleCredentialPayload | null
 *   loadGoogleIdentityServices() → Promise<void>
 *   promptGoogleSignIn(cb)   → triggers the GIS popup
 * ===================================================================== */

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export interface GoogleCredentialPayload {
  /** Subject — Google's stable user ID. */
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  hd?: string; // hosted domain
  aud?: string;
  iss?: string;
  exp?: number;
}

/** Lightly-typed view of the bit of the GIS API we use. */
type CredentialResponse = { credential: string };
type NotificationStub = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  getNotDisplayedReason?: () => string | undefined;
  getSkippedReason?: () => string | undefined;
};
type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (resp: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: (cb?: (notification: NotificationStub) => void) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  disableAutoSelect?: () => void;
};
interface GoogleGlobal {
  accounts?: {
    id?: GoogleIdApi;
  };
}
declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

/** Read the public Client ID from the Vite environment. */
export function getGoogleClientId(): string | undefined {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!value || typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Read the optional allowlist of institutional email domains. */
export function getAllowedDomains(): string[] {
  const raw = import.meta.env.VITE_GOOGLE_ALLOWED_DOMAINS;
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

/** Decode a Google ID-token JWT payload without verifying its signature.
 *  This is fine for reading display fields (email/name/picture) on the
 *  client — we never grant admin permissions based on this payload. */
export function parseJwtCredential(jwt: string): GoogleCredentialPayload | null {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = atob(padded);
    // Re-decode as UTF-8 to handle non-ASCII names safely.
    const text = decodeURIComponent(
      Array.from(json)
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(text) as GoogleCredentialPayload;
  } catch {
    return null;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Inject the GIS script once and resolve when `window.google.accounts.id`
 *  is available. Safe to call multiple times. */
export function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("GIS_LOAD_FAILED")),
        { once: true },
      );
      // It may already be ready.
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("GIS_LOAD_FAILED"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Trigger the Google sign-in popup. The supplied callback receives the
 *  ID-token credential string when the user picks an account. Errors are
 *  surfaced via `onError`. */
export async function promptGoogleSignIn(opts: {
  onCredential: (credential: string) => void;
  onError: (reason: "MISSING_CLIENT_ID" | "GIS_LOAD_FAILED" | "POPUP_DISMISSED") => void;
  /** Optional anchor element for rendering the GIS button — used as a
   *  reliable fallback when `prompt()` is blocked by the browser. */
  fallbackAnchor?: HTMLElement | null;
}): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    opts.onError("MISSING_CLIENT_ID");
    return;
  }

  try {
    await loadGoogleIdentityServices();
  } catch {
    opts.onError("GIS_LOAD_FAILED");
    return;
  }

  const idApi = window.google?.accounts?.id;
  if (!idApi) {
    opts.onError("GIS_LOAD_FAILED");
    return;
  }

  idApi.initialize({
    client_id: clientId,
    callback: (resp: CredentialResponse) => {
      if (resp?.credential) opts.onCredential(resp.credential);
      else opts.onError("POPUP_DISMISSED");
    },
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  });

  // Try the lightweight prompt first. If the browser refuses to display
  // it (FedCM / third-party cookies blocked / suppressed), render the
  // official GIS button into the fallback anchor so the user has a way
  // to complete sign-in.
  idApi.prompt((notification) => {
    const blocked =
      notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.();
    if (!blocked) return;
    if (opts.fallbackAnchor && idApi.renderButton) {
      opts.fallbackAnchor.innerHTML = "";
      idApi.renderButton(opts.fallbackAnchor, {
        type: "standard",
        theme: "filled_blue",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
      });
    } else {
      opts.onError("POPUP_DISMISSED");
    }
  });
}

/** True if `email`'s domain is allowed by `VITE_GOOGLE_ALLOWED_DOMAINS`,
 *  or if no allowlist is configured (development default). */
export function isEmailDomainAllowed(email: string): boolean {
  const allow = getAllowedDomains();
  if (allow.length === 0) return true;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return allow.includes(domain);
}
