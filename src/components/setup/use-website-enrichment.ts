import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProfileEnrichment, startProfileEnrichment } from "@/lib/website-enrichment.functions";
import { websiteKey, type WebsiteEnrichmentDTO } from "@/lib/website-enrichment";

const IDLE: WebsiteEnrichmentDTO = { status: "idle", websiteKey: null, domain: null };

/** Reads the durable server state; starting is always an explicit Create/Continue action. */
export function useWebsiteEnrichment(role: "seller" | "buyer" | "advisor", id: string, website: string, expectRead: boolean) {
  const get = useServerFn(getProfileEnrichment);
  const startFn = useServerFn(startProfileEnrichment);
  const [state, setState] = useState<WebsiteEnrichmentDTO>(() => expectRead && website.trim() ? { ...IDLE, status: "running", websiteKey: websiteKey(website) } : IDLE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const key = website.trim() ? websiteKey(website) : "";

  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;
    let idleReads = 0;
    const poll = async () => {
      try {
        const next = await get({ data: { role, id } });
        if (stopped) return;
        // A different website's old result never blocks or fills this page.
        const applicable = next.websiteKey && key && next.websiteKey !== key ? IDLE : next;
        setState(applicable);
        if (applicable.status === "running" || (expectRead && key && applicable.status === "idle" && ++idleReads < 15)) {
          timer = window.setTimeout(() => void poll(), 1000);
        }
      } catch {
        if (!stopped) setState(IDLE);
      }
    };
    void poll();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [role, id, key, expectRead, get]);

  const start = useCallback(async (nextWebsite?: string, retry = false) => {
    const site = (nextWebsite ?? website).trim();
    if (!site) return IDLE;
    setState({ status: "running", websiteKey: websiteKey(site), domain: null });
    const next = await startFn({ data: { role, id, website: site, retry } });
    setState(next);
    return next;
  }, [role, id, website, startFn]);

  return { state, start, setState };
}
