/** Browser-safe counting shared by buyer forms and existing server validators. */
export function descriptionWords(text: string, segmentThai = true): number {
  if (!text.trim()) return 0;
  const segmenter = segmentThai && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  return text.trim().split(/\s+/u).reduce((count, token) => {
    if (!segmenter || !/[\u0E00-\u0E7F]/u.test(token)) return count + 1;
    const words = [...segmenter.segment(token)].filter((part) => part.isWordLike).length;
    return count + Math.max(1, words);
  }, 0);
}
export function descriptionSentences(text: string): number {
  return text.trim() ? text.trim().split(/[.!?]+\s+(?=[A-Z0-9“”"'‘’([{])/u).filter((part) => part.trim()).length : 0;
}
export const singleLineDescription = (text: string) => text.replace(/[\r\n]+/g, ' ');
export function buyerDescriptionError(text: string): string | null {
  if (!text.trim()) return null;
  if (descriptionSentences(text) > 2) return 'Keep it to 2 sentences.';
  if (descriptionWords(text) > 25) return 'Keep it to 25 words.';
  if (text.trim().length < 10) return 'Write at least 10 characters.';
  return null;
}
/** Old descriptions are grandfathered only when the submitted value is unchanged. */
export const descriptionChanged = (next: string | undefined, stored: string | null | undefined) => next !== undefined && next !== (stored ?? '');