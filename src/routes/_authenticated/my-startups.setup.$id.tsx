import { useMemo, useRef, useState } from "react";
import { SellerAutoFill } from "@/components/startups/seller-auto-fill";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SellerWizard } from "@/components/startups/seller-wizard";
import { getSellerSetup, getSellerIdentityReadiness, saveSellerSetup, applySellerEnrich, type SellerSetup } from "@/lib/seller-setup.functions";
import { emptyDraft, firstUnanswered, listingPayload, SELLER_STEPS, normalizeSellerStep, fallbackSellerFounder, type SellerDraft } from "@/lib/seller-wizard";
import { z } from "zod";
import { tr } from "@/i18n/language";
import { SetupWizardLoading } from "@/components/setup/setup-wizard-loading";
import { useSessionContext } from "@/hooks/use-session-context";

export const Route = createFileRoute("/_authenticated/my-startups/setup/$id")({
  head: () => ({
    meta: [
      { title: "Business Setup Wizard — PitchSnack" },
      { name: "description", content: "Set up your business profile one question at a time." },
      { property: "og:title", content: "Business Setup Wizard — PitchSnack" },
      { property: "og:description", content: "Answer a few short questions to set up your business profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s) => z.object({ step: z.string().max(20).optional() }).parse(s),
  component: Page,
});

export const sellerSetupKey = (id: string) => ["seller-setup", id];

function toDraft(s: SellerSetup, open?: string): SellerDraft {
  const d: SellerDraft = {
    ...emptyDraft(), role: s.role, name: s.name, reg: s.reg, web: s.web, year: s.year, city: s.city,
    rev: s.rev, size: s.size, sector: s.sector, pick: s.pick, licences: s.licences as SellerDraft["licences"], iso: s.iso, addr: s.addr,
    reached: s.reached,
    shortDescription:s.shortDescription,longDescription:s.longDescription,productTags:s.productTags,marketTags:s.marketTags,
    shortDescriptionTh:s.shortDescriptionTh,longDescriptionTh:s.longDescriptionTh,productTagsTh:s.productTagsTh,marketTagsTh:s.marketTagsTh,
    founders:s.founders.length ? s.founders : [{ ...fallbackSellerFounder(s.role, s.owner.fullName), email: s.contact.email, phone: s.contact.phone }],
    highlights:s.highlights,highlightsTh:s.highlightsTh,
    hasLogo: !!s.media.logoPath, photos: s.media.slots.length,
    deal: s.listing.deal, stays: s.listing.stays, months: s.listing.months, price: s.listing.price,
    listingName: s.listing.name, nameOk: s.listing.name ? true : undefined,
    headline: s.listing.headline, headlineTh: s.listing.headlineTh, registeredName: s.registeredName, setupDoneAt: s.setupDoneAt,
  };
  // Opens the step asked for, else the first question without an answer (skipped included), else Review.
  const key = normalizeSellerStep(open) ?? firstUnanswered(d, s.fromSignup);
  const i = SELLER_STEPS.findIndex((x) => x.id === key);
  return { ...d, step: i < 0 ? SELLER_STEPS.length : i };
}

function Page() {
  const { id } = Route.useParams();
  const { step: openAt } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const fetchFn = useServerFn(getSellerSetup);
  const saveFn = useServerFn(saveSellerSetup);
  const fetchReadiness = useServerFn(getSellerIdentityReadiness);
  const applyFn = useServerFn(applySellerEnrich);
  const { data, error, refetch } = useQuery({ queryKey: sellerSetupKey(id), queryFn: () => fetchFn({ data: { id } }), staleTime: 0 });
  const initial = useMemo(() => (data ? toDraft(data, openAt) : null), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef<number | null>(null);
  const [fill, setFill] = useState<string | null>(null);
  const payload = (d: SellerDraft, done?: boolean) => ({
    shortDescription:d.shortDescription,longDescription:d.longDescription,productTags:d.productTags,marketTags:d.marketTags,
    shortDescriptionTh:d.shortDescriptionTh,longDescriptionTh:d.longDescriptionTh,productTagsTh:d.productTagsTh,marketTagsTh:d.marketTagsTh,founders:d.founders,
    highlights:d.highlights,highlightsTh:d.highlightsTh,
    id, role: d.role, name: d.name, reg: d.reg, web: d.web, year: d.year, city: d.city, rev: d.rev, size: d.size,
    sector: d.sector, pick: (d.pick ?? null) as never, licences: d.licences, iso: d.iso, addr: d.addr, done, reached: (d.reached ?? null) as never, listing: listingPayload(d),
  });
  const persist = (d: SellerDraft) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveFn({ data: payload(d) }).catch((e: Error) => toast.error(e.message)); }, 400);
  };
  const completed = async () => {
    // Re-read after enrichment so the test matches the values the editor actually displays.
    let missing = true;
    try { missing = (await fetchReadiness({ data: { id } })).missing; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not read listing information"); }
    void qc.invalidateQueries();
    navigate({ to: "/my-startups", search: missing ? { panel:id, edit:"startup", view:"public", tab:"identity", tour:"seller-identity" } : { panel:id, edit:"startup", view:"private", tab:"images" } });
  };
  const leave = () => { void qc.invalidateQueries(); navigate({ to: "/my-startups", search: { open: id } as never }); };

  if (error || !data || !initial || !session?.user?.id) return <SetupWizardLoading title={tr("Set up your business")} error={error} onRetry={() => void refetch()} />;
  if (fill) return <SellerAutoFill id={id} web={fill} onDone={() => { void completed(); }} />;
  return (
    <SellerWizard
      userId={session.user.id}
      initial={initial}
      owner={data.owner}
      listingPreview={{ refNo: data.listing.refNo, cover: data.listing.cover }}
      fromSignup={data.fromSignup}
      persist={persist}
      media={{ startupId: id, tenantId: data.tenantId, initial: data.media, facts: { name: data.name, web: data.web } }}
      title="Set up your business"
      onExit={leave}
      onCancel={leave}
      onFinish={async (d) => {
        if (timer.current) window.clearTimeout(timer.current);
        try { await saveFn({ data: payload(d, true) }); } catch (e) { toast.error((e as Error).message); return; }
        if(d.enrichResult) {try { await applyFn({data:{id,r:d.enrichResult as never}}); } catch(e) {toast.error(e instanceof Error ? e.message : "Could not save website findings");}}
        else if (d.web.trim()) { setFill(d.web); return; }
        await completed();
      }}
    />
  );
}
