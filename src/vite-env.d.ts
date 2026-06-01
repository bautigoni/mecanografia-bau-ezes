/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_ALLOWED_DOMAINS?: string;
  /** Internal backend endpoint for sending invitation emails. Never a key. */
  readonly VITE_INVITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
