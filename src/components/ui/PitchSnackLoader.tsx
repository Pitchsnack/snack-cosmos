/* ============================================================
   PitchSnack loading components
   Requires: /public/css/pitchsnack-loader.css (linked once in __root)
   The hat paths are inlined deliberately — external <use> refs
   fail over file:// and in some Safari versions. Keep them inline.
   ============================================================ */

import { useEffect, useState, type ReactNode } from "react";

const HAT_PATHS = (
  <>
    <path d="M97.9 59.19C96.82 58.8 96.26 58.52 89.38 54.98C86.65 53.58 74.59 47.39 62.58 41.22C50.57 35.06 40.33 29.79 39.83 29.53C37.4 28.23 35.32 26.94 35.23 26.67C35.21 26.62 35.24 26.49 35.29 26.39C35.97 25.09 41.54 18.06 44.27 15.06C45.42 13.8 48.13 11.59 50.34 10.1C53.35 8.07 56.71 6.48 60.25 5.4C61.38 5.06 63.35 4.55 64.01 4.43C65.41 4.18 67.42 4.05 69.99 4.05C75.03 4.05 76.62 4.44 78.32 6.05C80.29 7.92 80.88 9.63 82.13 16.96C82.78 20.74 83.22 22.52 83.7 23.29C84.07 23.88 84.91 24.6 85.67 24.98C87.58 25.94 90.17 26.34 95.37 26.46C98.26 26.53 98.91 26.62 99.91 27.1C100.83 27.55 101.42 28.15 102.1 29.35C104.47 33.48 105.28 39.97 104.19 45.96C103.84 47.86 103.26 49.78 102.31 52.14C101.19 54.94 99.71 58.14 99.06 59.17C98.94 59.37 98.91 59.38 98.67 59.38C98.51 59.38 98.19 59.3 97.9 59.19Z" />
    <path d="M111.41 89.65C109.63 89.53 106.41 89.01 104.34 88.49C100.58 87.55 94.3 85.5 90.27 83.91C89.16 83.47 82.51 80.58 80.66 79.73C69.77 74.73 53.79 65.58 42.34 57.81C23.37 44.92 8.84 31.64 4.98 23.65C3.94 21.48 3.78 20.15 4.35 18.13C4.79 16.54 5.46 15.43 6.2 15.02C7.29 14.41 8.17 14.39 9.55 14.94C12.08 15.94 14.56 17.79 18.73 21.77C20.42 23.38 23.22 26.28 25.35 28.6C28.43 31.98 29.17 32.7 29.75 32.84C29.86 32.86 29.94 32.84 30.07 32.73C30.31 32.53 30.5 32.55 31.25 32.85C33.06 33.57 36.1 35.11 50.44 42.56C55.58 45.23 61.92 48.5 67.65 51.44C69.43 52.36 73.79 54.6 77.35 56.43C80.9 58.26 85.43 60.58 87.4 61.58C92.34 64.09 93.96 64.96 95.19 65.75C95.61 66.02 95.7 66.1 95.7 66.21C95.7 66.42 95.37 67.28 94.71 68.74C94.11 70.1 93.65 71.22 93.53 71.62C93.45 71.89 93.49 71.97 93.76 72.12C93.99 72.23 95.3 72.6 97.89 73.28C105.5 75.26 111.44 77.31 115.38 79.31C116.72 79.99 117.43 80.46 118.17 81.17C120.16 83.07 120.51 84.72 119.28 86.45C118.92 86.96 117.88 88.02 117.36 88.41C116.49 89.06 115.42 89.48 114.22 89.62C113.76 89.68 112.15 89.69 111.41 89.65Z" />
  </>
);

export type HatSize = "xs" | "sm" | "md" | "lg";

/** Never show a loader for under 300ms — a flash reads as a glitch. */
export function useLoaderDelay(delay = 300) {
  const [ready, setReady] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready;
}

export function HatMark({
  size = "md",
  invert = false,
  className = "",
  animated = true,
}: {
  size?: HatSize;
  invert?: boolean;
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 124 93.7"
      fill="currentColor"
      aria-hidden="true"
      className={[
        "ps-loader",
        `ps-loader--${size}`,
        animated ? "ps-tip" : "",
        invert ? "ps-loader--invert" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {HAT_PATHS}
    </svg>
  );
}

/* ── A · tip of the hat ─────────────────────────────────────── */

export function Loading({
  message,
  size = "md",
  className = "",
  delay = 300,
}: {
  message?: ReactNode;
  size?: HatSize;
  className?: string;
  delay?: number;
}) {
  const ready = useLoaderDelay(delay);
  if (!ready) return <div className={`ps-loading ${className}`} aria-hidden="true" />;
  return (
    <div className={`ps-loading ${className}`} role="status" aria-live="polite">
      <HatMark size={size} />
      {message && <p className="ps-loading__msg">{message}</p>}
      <span className="ps-sr">Loading</span>
    </div>
  );
}

export function LoadingOverlay({ message = "Loading…", delay = 300 }: { message?: string; delay?: number }) {
  const ready = useLoaderDelay(delay);
  if (!ready) return null;
  return (
    <div className="ps-loading ps-loading--overlay" role="status" aria-live="polite">
      <HatMark size="lg" />
      <p className="ps-loading__msg">{message}</p>
      <span className="ps-sr">Loading</span>
    </div>
  );
}

/* ── button state — static hat, pulsing label ───────────────── */

export function ButtonLoading({ label = "Saving…", invert = true }: { label?: string; invert?: boolean }) {
  return (
    <>
      <HatMark size="xs" invert={invert} animated={false} />
      <span className="ps-btn-loading__label">{label}</span>
    </>
  );
}

/** Static hat only, no label — inline row actions. */
export function ButtonSpinner({ invert = true, className = "" }: { invert?: boolean; className?: string }) {
  return <HatMark size="xs" invert={invert} animated={false} className={className} />;
}

/* ── B · skeleton ───────────────────────────────────────────── */

export function Skeleton({
  lines = 4,
  showHead = true,
  headMessage,
  delay = 300,
}: {
  lines?: number;
  showHead?: boolean;
  headMessage?: string;
  delay?: number;
}) {
  const ready = useLoaderDelay(delay);
  if (!ready) return <div className="ps-skeleton" aria-hidden="true" />;
  const widths = ["w95", "w85", "w60", "w40"];
  return (
    <div className="ps-skeleton" role="status" aria-live="polite">
      {showHead && (
        <div className="ps-skeleton__head">
          <HatMark size="sm" />
          {headMessage && <span className="ps-skeleton__head-msg">{headMessage}</span>}
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`ps-skeleton__bar ps-skeleton__bar--${widths[i % widths.length]}`} />
      ))}
      <span className="ps-sr">Loading</span>
    </div>
  );
}

export { Skeleton as HatSkeleton };
