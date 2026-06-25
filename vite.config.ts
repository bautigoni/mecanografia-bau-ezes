import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev-only: proxy /api to the production API (which runs against
    // Supabase). Keeps the browser same-origin so there are no CORS or
    // cross-site cookie issues — local frontend uses the real backend/DB.
    proxy: {
      "/api": {
        target: "https://typely.bauhub.online",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // Source maps publicados para debugging en producción (Lighthouse
    // "Buenas prácticas"). No exponen secretos: el frontend es público.
    sourcemap: true,
  },
});
