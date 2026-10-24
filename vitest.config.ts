import { defineConfig } from "vitest/config";

// Tests don't need CSS; an inline PostCSS config stops Vite loading the Tailwind postcss.config.mjs,
// whose string-plugin form Vite rejects ("Invalid PostCSS Plugin found at: plugins[0]").
export default defineConfig({
  css: { postcss: {} },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  esbuild: { jsx: "automatic" },
  // Tests never read this machine's calling switch (.uplink-calling): no file means on.
  test: { env: { UPLINK_CALLING_FILE: "/nonexistent/uplink-calling" } },
});
