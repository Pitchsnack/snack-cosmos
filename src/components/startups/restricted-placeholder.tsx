import { Lock } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Reads the restriction keys attached by maskRestricted(). */
export function restrictedSet(item: unknown): Set<string> {
  const keys = (item as { restricted_fields?: string[] } | null)?.restricted_fields ?? [];
  return new Set(keys);
}

/** Greyed-out placeholder shown in place of a restricted value. */
export function RestrictedPill({
  label = "Restricted",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      title="Restricted from non-authorized users"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70",
        className,
      )}
    >
      <Lock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

/** Deterministic pseudo-random generator so a mosaic is stable per seed. */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pixelated / mosaic masking for restricted images (logos, banners, avatars).
 * The original image is NEVER fetched or referenced — the mosaic is generated
 * locally from the record id, so no URL, alt text or cached bitmap can leak.
 * The caller controls the box, so original dimensions and shape (including
 * circular avatars) are preserved.
 */
export function MaskedImage({
  seed = "restricted",
  className,
  cells = 8,
  showLock = true,
  lockClassName,
  label = "Restricted content",
}: {
  seed?: string;
  className?: string;
  cells?: number;
  showLock?: boolean;
  lockClassName?: string;
  label?: string;
}) {
  const tiles = useMemo(() => {
    const rand = hash(seed);
    return Array.from({ length: cells * cells }, () => 0.18 + rand() * 0.55);
  }, [seed, cells]);

  return (
    <div
      role="img"
      aria-label={label}
      title="Restricted from non-authorized users"
      data-masked="image"
      className={cn("relative h-full w-full overflow-hidden bg-muted select-none", className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 grid blur-[1px]"
        style={{
          gridTemplateColumns: `repeat(${cells}, 1fr)`,
          gridTemplateRows: `repeat(${cells}, 1fr)`,
        }}
      >
        {tiles.map((o, i) => (
          <div
            key={i}
            style={{
              backgroundColor: `color-mix(in srgb, var(--muted-foreground) ${Math.round(o * 100)}%, var(--muted))`,
            }}
          />

        ))}
      </div>
      {showLock && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock
            className={cn("h-3.5 w-3.5 text-background drop-shadow", lockClassName)}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}

/**
 * Greyed-out block placeholder (kept for surfaces with no image box to mask).
 * Prefer MaskedImage when the field is an image.
 */
export function RestrictedBlock({ className }: { className?: string }) {
  return (
    <div
      title="Restricted from non-authorized users"
      className={cn(
        "flex h-full w-full items-center justify-center bg-muted text-muted-foreground/60",
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5" />
    </div>
  );
}
