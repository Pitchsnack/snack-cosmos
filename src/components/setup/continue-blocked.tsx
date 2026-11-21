/** Setup wizards: one line under the buttons naming what Continue still needs. */
export function continueBlockedLine(missing: string[], lang: "en" | "th", upload = false, invalid: string[] = []): string | null {
  if (upload) return lang === "th" ? "เพิ่มรูปภาพอย่างน้อย 1 รูปเพื่อดำเนินการต่อ" : "To continue, add at least 1 photo.";
  const and = lang === "th" ? " และ " : " and ";
  const list = (values: string[]) => {
    const unique = [...new Set(values.filter(Boolean))];
    return unique.length < 2 ? (unique[0] ?? "") : `${unique.slice(0, -1).join(", ")}${and}${unique[unique.length - 1]}`;
  };
  const m = list(missing);
  const bad = list(invalid.filter((field) => !m.includes(field)));
  if (m && bad) return lang === "th" ? `กรอก ${m} และตรวจสอบ ${bad} เพื่อดำเนินการต่อ` : `To continue, fill in ${m} and check ${bad}.`;
  if (bad) return lang === "th" ? `ตรวจสอบ ${bad} เพื่อดำเนินการต่อ` : `To continue, check ${bad}.`;
  if (m) return lang === "th" ? `กรอก ${m} เพื่อดำเนินการต่อ` : `To continue, fill in ${m}.`;
  return null;
}

export function ContinueBlockedLine({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <p className="mt-2.5 text-right text-[13px] text-destructive max-sm:text-left" aria-live="polite" data-continue-blocked>{text}</p>;
}
