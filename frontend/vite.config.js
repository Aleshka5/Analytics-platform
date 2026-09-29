import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The page container serves `vite preview`. Proxy there as well as in `vite dev`,
// or the browser's /api calls never reach analytics-api on the Podman network.
const apiProxy = {
  "/api": {
    target: "http://analytics-api:8000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
  },
  test: {
    environment: "jsdom",
  },
});
