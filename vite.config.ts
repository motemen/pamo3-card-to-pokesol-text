import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // base: process.env.NODE_ENV == "test" ? "/" : "/pamo3-card-to-pokesol-text/",
  base: "/pamo3-card-to-pokesol-text/",
  test: {
    browser: {
      enabled: true,
      name: "chromium",
      provider: "playwright",
    },
  },
});
