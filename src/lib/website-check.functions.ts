import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Checks that a public website responds (HEAD, then GET) within ~5 seconds. */
export const checkWebsiteReachable = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().trim().url().max(2048) }).parse(data))
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!/^https?:$/.test(u.protocol)) return { ok: false };
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host.endsWith(".internal")) {
      return { ok: false };
    }
    for (const method of ["HEAD", "GET"] as const) {
      try {
        const res = await fetch(u.toString(), {
          method,
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
          headers: { "user-agent": "Mozilla/5.0 (compatible; PitchsnackLinkCheck/1.0)" },
        });
        // Any HTTP answer (even 403/405) means the site exists and responds.
        if (res.status < 500) return { ok: true };
      } catch {
        // try next method
      }
    }
    return { ok: false };
  });
