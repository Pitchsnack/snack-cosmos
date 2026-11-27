/** Browser-safe lifecycle for the seller wizard's background listing-text step. */

export const LISTING_PREPARE_TIMEOUT_MS = 15_000;

export type ListingTextFields = {
  listingName?: string | null;
  headline?: string | null;
  headlineTh?: string | null;
  description?: string | null;
  descriptionTh?: string | null;
};

const filled = (v: string | null | undefined) => !!v?.trim();

/** The background step runs only while the listing name, headline or description is empty. */
export function listingTextsMissing(d: ListingTextFields): boolean {
  return !filled(d.listingName) || !(filled(d.headline) || filled(d.headlineTh)) || !(filled(d.description) || filled(d.descriptionTh));
}

/** Apply a background result only to fields that are still empty in the wizard, never over what the seller wrote. */
export function fillEmptyListingTexts<T extends ListingTextFields>(current: T, patch: Partial<T>): T {
  const next: T = { ...current };
  const take = (key: keyof ListingTextFields) => {
    const value = patch[key];
    if (typeof value === "string" && value.trim() && !filled(current[key] as string | null | undefined)) (next as Record<string, unknown>)[key] = value;
  };
  take("listingName");
  take("headline");
  take("headlineTh");
  const descriptionWasEmpty = !filled(current.description) && !filled(current.descriptionTh);
  if (descriptionWasEmpty) {
    take("description");
    take("descriptionTh");
    if ("descriptionStory" in patch) (next as Record<string, unknown>).descriptionStory = patch.descriptionStory;
    if ("descriptionStoryTh" in patch) (next as Record<string, unknown>).descriptionStoryTh = patch.descriptionStoryTh;
  }
  if (next.listingName !== current.listingName && "nameOk" in patch) (next as Record<string, unknown>).nameOk = patch.nameOk;
  const changed = (["listingName", "headline", "headlineTh", "description", "descriptionTh"] as const).some((k) => next[k] !== current[k]);
  if (changed && "listingTextTranslations" in patch) (next as Record<string, unknown>).listingTextTranslations = patch.listingTextTranslations;
  return next;
}

export class ListingPrepareTimeout extends Error {
  constructor() { super("LISTING_PREPARE_TIMEOUT"); }
}

export type ListingPrepareHandlers<P> = {
  onBusy: (busy: boolean) => void;
  onPatch: (patch: P) => void;
  onFailed: (failed: boolean) => void;
  timeoutMs?: number;
};

/**
 * The busy state belongs to the run, not to the screen: each run ends it when it
 * succeeds, fails or hits the time limit, unless a newer run has started since.
 * Step changes, cleanups and second mounts never leave it on.
 */
export function createListingPrepareRunner<P>(handlers: ListingPrepareHandlers<P>) {
  let latest = 0;
  const timeoutMs = handlers.timeoutMs ?? LISTING_PREPARE_TIMEOUT_MS;
  return {
    run(task: () => Promise<P>): Promise<void> {
      const id = ++latest;
      handlers.onBusy(true);
      handlers.onFailed(false);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ListingPrepareTimeout()), timeoutMs); });
      let work: Promise<P>;
      try { work = task(); } catch (error) { work = Promise.reject(error); }
      return Promise.race([work, limit])
        .then((patch) => { if (id === latest) handlers.onPatch(patch); }, () => { if (id === latest) handlers.onFailed(true); })
        .finally(() => { if (timer !== undefined) clearTimeout(timer); if (id === latest) handlers.onBusy(false); });
    },
  };
}
