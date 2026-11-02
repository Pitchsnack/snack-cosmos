import { defineConfig } from "vitest/config";

// Handler unit tests mock RPC construction; Vite's Start transform would replace those mocks with SSR RPCs.
export default defineConfig({
  resolve: { alias: { "@": new URL("../../src", import.meta.url).pathname } },
  test: { include: ["test/approvals/advisor-registration-functions.test.ts"] },
});