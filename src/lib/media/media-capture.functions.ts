/**
 * Website screenshot server function.
 *
 * Contract:
 *   - Returns image bytes only (base64). NEVER writes to storage, NEVER
 *     inserts startup_media, NEVER uses supabaseAdmin.
 *   - The UI stages the returned image as a pendingFile via
 *     mediaCaptureAdapter.captureWebsiteScreenshot(...); the existing
 *     save-on-submit flow performs the actual storage upload and DB insert.
 *
 * Security:
 *   - Requires an authenticated session (requireSupabaseAuth).
 *   - Only public http(s) URLs are accepted. Localhost, loopback, private
 *     IPv4/IPv6 ranges, link-local addresses, and non-web schemes are
 *     rejected to prevent SSRF.
 *   - Provider request is bounded by an AbortController timeout and a
 *     maximum response size (10 MB, matches the image upload cap).
 *   - Content-type is validated to be an image before the bytes are
 *     returned. Bytes / base64 / API key / raw provider responses are
 *     never logged.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const REQUEST_TIMEOUT_MS = 20_000;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const inputSchema = z.object({
  websiteUrl: z.string().trim().min(1).max(2048),
});

type Ok = {
  ok: true;
  imageBase64: string;
  contentType: string;
  fileSizeBytes: number;
};

type Err = {
  ok: false;
  error: "not_configured" | "invalid_url" | "too_large" | "timeout" | "failed";
  message?: string;
};

export const captureWebsiteScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<Ok | Err> => {
    const apiKey = process.env.SCREENSHOT_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "not_configured" };
    }

    const urlCheck = validatePublicWebUrl(data.websiteUrl);
    if (!urlCheck.ok) {
      return { ok: false, error: "invalid_url", message: urlCheck.reason };
    }

    // Provider: ScreenshotOne. Isolated to this file; UI/adapter know nothing.
    const providerUrl = new URL("https://api.screenshotone.com/take");
    providerUrl.searchParams.set("access_key", apiKey);
    providerUrl.searchParams.set("url", urlCheck.url.toString());
    providerUrl.searchParams.set("format", "png");
    providerUrl.searchParams.set("viewport_width", "1280");
    providerUrl.searchParams.set("viewport_height", "800");
    providerUrl.searchParams.set("block_ads", "true");
    providerUrl.searchParams.set("block_cookie_banners", "true");
    providerUrl.searchParams.set("cache", "false");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(providerUrl.toString(), {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, error: "timeout" };
      }
      // Do not include provider details in the message returned to the UI.
      console.warn("[capture-screenshot] provider request failed");
      return { ok: false, error: "failed" };
    }
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("[capture-screenshot] provider non-2xx", response.status);
      return { ok: false, error: "failed", message: `Provider status ${response.status}` };
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      console.warn("[capture-screenshot] rejected content-type");
      return { ok: false, error: "failed", message: "Unexpected content type" };
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength && declaredLength > MAX_BYTES) {
      return { ok: false, error: "too_large" };
    }

    // Stream-read with a hard size cap so we don't buffer > MAX_BYTES.
    let received = 0;
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();
    if (!reader) {
      return { ok: false, error: "failed", message: "Empty response" };
    }
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > MAX_BYTES) {
          try { await reader.cancel(); } catch { /* ignore */ }
          return { ok: false, error: "too_large" };
        }
        chunks.push(value);
      }
    } catch {
      return { ok: false, error: "failed" };
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }

    const imageBase64 = bytesToBase64(bytes);
    return {
      ok: true,
      imageBase64,
      contentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
      fileSizeBytes: received,
    };
  });

/* -------------------------------------------------------------------------- */
/*  URL safety                                                                */
/* -------------------------------------------------------------------------- */

function validatePublicWebUrl(input: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }
  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "Missing host" };

  // Block hostnames that resolve locally by name.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return { ok: false, reason: "Host not allowed" };
  }

  // IPv4 literals — reject loopback / private / link-local / reserved.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    if (parts.some((p) => p < 0 || p > 255)) {
      return { ok: false, reason: "Invalid IP" };
    }
    const [a, b] = parts;
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast / reserved
    ) {
      return { ok: false, reason: "Private / reserved IP not allowed" };
    }
  }

  // IPv6 literals — reject loopback / link-local / unique-local.
  if (host.startsWith("[") && host.endsWith("]")) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (
      v6 === "::1" ||
      v6 === "::" ||
      v6.startsWith("fe80:") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd")
    ) {
      return { ok: false, reason: "Private / reserved IP not allowed" };
    }
  }

  return { ok: true, url };
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunk to avoid call-stack overflow for large arrays.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  // btoa is available in Workers and modern runtimes.
  return btoa(binary);
}
