import { cn } from "@/lib/utils";

/** Setup wizards: a 10px grey band edge to edge across the card between two sections. `bleed` cancels the card's side padding. */
export function SectionBand({ bleed }: { bleed: string }) {
  return <div aria-hidden className={cn("my-[22px] h-[10px] bg-[var(--setup-band)] sm:my-[26px]", bleed)} />;
}

/** Section heading in the step's style: 18px, display font, bold, 14px above its fields. */
export function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h3 id={id} className="mb-[14px] text-[18px] font-bold leading-snug text-foreground" style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}>{children}</h3>;
}

/** "Short description — a one-line summary": the part after the dash in normal weight and grey. */
export function DashLabel({ main, rest }: { main: string; rest: string }) {
  return <>{main}<span className="font-normal text-muted-foreground"> — {rest}</span></>;
}

export const DESC_LABELS = {
  short: { main: ["Short description", "คำอธิบายสั้น"], rest: ["a one-line summary", "สรุปในหนึ่งบรรทัด"] },
  long: { main: ["Long description", "คำอธิบายแบบยาว"], rest: ["a fuller overview", "ภาพรวมที่ละเอียดขึ้น"] },
} as const;
