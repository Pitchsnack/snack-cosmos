export type HighlightLang = "en" | "th";
export type HighlightTranslation = { index: number; target: HighlightLang; source: string };
export type HighlightValues = {
  en: string[];
  th: string[];
  translations: HighlightTranslation[];
};
export type HighlightInput = { en?: (string | null)[] | null; th?: (string | null)[] | null };
export type HighlightJob = { index: number; sourceLang: HighlightLang; target: HighlightLang; text: string };
export type HighlightPlan = HighlightValues & { jobs: HighlightJob[]; changed: boolean };

export const hasThaiLetter = (value: string | null | undefined) => /[\u0E00-\u0E7F]/.test(value ?? "");
export const highlightRows = (rows?: (string | null)[] | null) =>
  Array.from({ length: 4 }, (_, i) => (rows?.[i] ?? "").trim());

export function cleanHighlightTranslations(value: unknown): HighlightTranslation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: HighlightTranslation[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const index = Number(item.index);
    const target = item.target === "en" || item.target === "th" ? item.target : null;
    const source = typeof item.source === "string" ? item.source.trim() : "";
    if (!target || !Number.isInteger(index) || index < 0 || index > 3 || !source) continue;
    const key = `${index}:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ index, target, source });
  }
  return out;
}

export function isTranslatedHighlight(values: Pick<HighlightValues, "en" | "th" | "translations">, index: number, target: HighlightLang) {
  const mark = values.translations.find((item) => item.index === index && item.target === target);
  if (!mark) return false;
  const source = target === "en" ? highlightRows(values.th)[index] : highlightRows(values.en)[index];
  return !!source && source === mark.source && !!highlightRows(target === "en" ? values.en : values.th)[index];
}

export function withoutHighlightTranslation(marks: unknown, index: number, target: HighlightLang) {
  return cleanHighlightTranslations(marks).filter((item) => item.index !== index || item.target !== target);
}

/**
 * Routes newly typed text by its characters, not the selected UI tab. Existing stored
 * values keep their language during a backfill. A manually changed target loses its
 * automatic mark; only blank or still-automatic targets produce translation jobs.
 */
export function planHighlightSave(
  current: { en?: (string | null)[] | null; th?: (string | null)[] | null; translations?: unknown } | null,
  input: HighlightInput,
): HighlightPlan {
  const curEn = highlightRows(current?.en);
  const curTh = highlightRows(current?.th);
  const en = highlightRows(input.en === undefined ? curEn : input.en);
  const th = highlightRows(input.th === undefined ? curTh : input.th);
  let translations = cleanHighlightTranslations(current?.translations);
  const changedEn = [false, false, false, false];
  const changedTh = [false, false, false, false];

  for (let i = 0; i < 4; i++) {
    changedEn[i] = input.en !== undefined && en[i] !== curEn[i];
    changedTh[i] = input.th !== undefined && th[i] !== curTh[i];

    // English (or other non-Thai text) typed while the Thai box is showing belongs in English.
    if (changedTh[i] && th[i] && !hasThaiLetter(th[i]) && !changedEn[i]) {
      en[i] = th[i];
      th[i] = curTh[i];
      changedEn[i] = en[i] !== curEn[i];
      changedTh[i] = false;
    } else if (changedEn[i] && en[i] && hasThaiLetter(en[i]) && !changedTh[i]) {
      // Thai typed while the English box is showing belongs in Thai.
      th[i] = en[i];
      en[i] = curEn[i];
      changedTh[i] = th[i] !== curTh[i];
      changedEn[i] = false;
    }

    if (changedEn[i]) translations = withoutHighlightTranslation(translations, i, "en");
    if (changedTh[i]) translations = withoutHighlightTranslation(translations, i, "th");

    // Older rows followed the selected UI language, so English can already be stored
    // under Thai (and vice versa). Route untouched one-language rows by their letters.
    if (!changedEn[i] && !changedTh[i] && !en[i] && th[i] && !hasThaiLetter(th[i])) {
      en[i] = th[i];
      th[i] = "";
      translations = withoutHighlightTranslation(withoutHighlightTranslation(translations, i, "en"), i, "th");
    } else if (!changedEn[i] && !changedTh[i] && !th[i] && en[i] && hasThaiLetter(en[i])) {
      th[i] = en[i];
      en[i] = "";
      translations = withoutHighlightTranslation(withoutHighlightTranslation(translations, i, "en"), i, "th");
    } else if (!changedEn[i] && !changedTh[i] && en[i] && en[i] === th[i] && !hasThaiLetter(en[i])) {
      // Repair the first backfill's identical placeholder translations: non-Thai
      // source text marked as an English translation is actually the English original.
      const mark = translations.find((item) => item.index === i && item.target === "en" && item.source === en[i]);
      if (mark) {
        th[i] = "";
        translations = withoutHighlightTranslation(translations, i, "en");
      }
    }
  }

  // Removing an original also removes its untouched automatic translation.
  for (const mark of translations) {
    const source = mark.target === "en" ? th[mark.index] : en[mark.index];
    if (source) continue;
    if (mark.target === "en") en[mark.index] = "";
    else th[mark.index] = "";
  }
  translations = translations.filter((mark) => mark.target === "en" ? !!th[mark.index] : !!en[mark.index]);

  const jobs: HighlightJob[] = [];
  for (let i = 0; i < 4; i++) {
    const autoEn = translations.some((mark) => mark.index === i && mark.target === "en");
    const autoTh = translations.some((mark) => mark.index === i && mark.target === "th");
    if (th[i] && !changedEn[i] && (!en[i] || (autoEn && changedTh[i]))) {
      jobs.push({ index: i, sourceLang: "th", target: "en", text: th[i] });
    }
    if (en[i] && !changedTh[i] && (!th[i] || (autoTh && changedEn[i]))) {
      jobs.push({ index: i, sourceLang: "en", target: "th", text: en[i] });
    }
  }

  const before = JSON.stringify({ en: curEn, th: curTh, translations: cleanHighlightTranslations(current?.translations) });
  const after = JSON.stringify({ en, th, translations });
  return { en, th, translations, jobs, changed: before !== after || jobs.length > 0 };
}
