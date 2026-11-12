/** Setup wizards: one line under the buttons naming what Continue still needs. */
export function continueBlockedLine(missing: string[], lang: "en" | "th", upload = false): string | null {
  if (upload) return lang === "th" ? "เพิ่มรูปภาพอย่างน้อย 1 รูปเพื่อดำเนินการต่อ" : "To continue, add at least 1 photo.";
  const m = [...new Set(missing.filter(Boolean))];
  if (!m.length) return null;
  const and = lang === "th" ? " และ " : " and ";
  const list = m.length === 1 ? m[0] : `${m.slice(0, -1).join(", ")}${and}${m[m.length - 1]}`;
  return lang === "th" ? `กรอก ${list} เพื่อดำเนินการต่อ` : `To continue, fill in ${list}.`;
}

export function ContinueBlockedLine({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <p className="mt-2.5 text-right text-[13px] text-destructive max-sm:text-left" aria-live="polite" data-continue-blocked>{text}</p>;
}
