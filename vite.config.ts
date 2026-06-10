import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Source maps publicados para debugging en producción (Lighthouse
    // "Buenas prácticas"). No exponen secretos: el frontend es público.
    sourcemap: true,
  },
});
