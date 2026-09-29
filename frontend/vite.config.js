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

// Host names the page may be served under besides localhost, from WEB_ALLOWED_HOSTS
// in .env (comma-separated). Vite blocks requests for any other Host header.
const allowedHosts = (process.env.WEB_ALLOWED_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter((host) => host !== "");

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
    allowedHosts,
  },
  test: {
    environment: "jsdom",
  },
});
