// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

// ✅ __dirname workaround for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Sentry plugin disabled in development due to glob import compatibility issues
    // Re-enable in production when needed
  ],
  server: {
    proxy: {
      // Proxy API calls to FastAPI during `npm run dev`
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket upgrades to the backend
      "/ws": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["@xstate/react", "xstate"],
  },
  build: {
    sourcemap: true, // Enable source maps for Sentry
  },
});
