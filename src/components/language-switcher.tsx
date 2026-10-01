import { cn } from "@/lib/utils";
import { useTranslation, type Language } from "@/i18n/language";

const OPTIONS: { code: Language; label: string; title: string }[] = [
  { code: "en", label: "EN", title: "English" },
  { code: "th", label: "TH", title: "ภาษาไทย" },
];

/**
 * Compact [ EN | TH ] pill.
 * `tone="dark"` is for the dark global bar, `"light"` for the workspace header.
 */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { language, setLanguage } = useTranslation();
  const dark = tone === "dark";

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg p-0.5",
        dark ? "bg-white/[0.07]" : "border border-border bg-muted/40",
      )}
    >
      {OPTIONS.map((o) => {
        const active = language === o.code;
        return (
          <button
            key={o.code}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => setLanguage(o.code)}
            className={cn(
              "h-7 rounded-[7px] px-2 text-[11px] font-semibold tracking-wide transition-colors",
              active
                ? dark
                  ? "bg-white text-[#141a2b]"
                  : "bg-background text-foreground shadow-sm"
                : dark
                  ? "text-[#a9b0c3] hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
