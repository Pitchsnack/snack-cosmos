/**
 * PRD P-17 V4 — Adapter seam for Global Startups Registry.
 *
 * This is the ONLY frontend-facing module that exposes global startup
 * registry and import operations. UI components, routes, and hooks must
 * never touch `src/lib/global-startups.functions.ts` directly.
 *
 * Today this wraps Lovable Cloud server functions. Tomorrow it can be
 * re-pointed at the external API Gateway by changing only this file and
 * `src/lib/global-startups.functions.ts` — no UI/component/route changes.
 */
import {
  listGlobalStartupsFn,
  getGlobalStartupFn,
  createGlobalStartupFn,
  updateGlobalStartupFn,
  setGlobalStartupStatusFn,
  listImportsOfGlobalStartupFn,
  importGlobalStartupFn,
  type GlobalStartup,
  type GlobalStartupImportSummary,
  type GlobalStartupStatus,
} from "@/lib/global-startups.functions";

export type {
  GlobalStartup,
  GlobalStartupImportSummary,
  GlobalStartupStatus,
};

// Re-export the server function references so hooks can use `useServerFn`.
// This keeps the adapter the single import path for global/import flows.
export const listGlobalStartups = listGlobalStartupsFn;
export const getGlobalStartup = getGlobalStartupFn;
export const createGlobalStartup = createGlobalStartupFn;
export const updateGlobalStartup = updateGlobalStartupFn;
export const setGlobalStartupStatus = setGlobalStartupStatusFn;
export const listImportsOfGlobalStartup = listImportsOfGlobalStartupFn;
export const importGlobalStartup = importGlobalStartupFn;
