/**
 * Shared tab furniture for the Financials area.
 *
 * The active tab and active sub-tab are filled with the app's existing accent
 * orange (--accent, the same token the Startup Directory's "New startup"
 * button uses), outlined in --accent-dark, which is derived from it.
 * Icons are inline SVG — no dependency.
 */
import { useEffect, useRef } from "react";

export type TabIconName =
  | "grid"
  | "building"
  | "document"
  | "percent"
  | "tag"
  | "trend"
  | "scales"
  | "flow"
  | "target"
  | "lines"
  | "sliders";

const PATHS: Record<TabIconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  building: (
    <>
      <path d="M3 14V3.5L8 2l5 1.5V14" />
      <path d="M2 14h12M6 6h1M9 6h1M6 9h1M9 9h1" />
    </>
  ),
  document: (
    <>
      <path d="M4 2h6l3 3v9H4z" />
      <path d="M10 2v3h3M6 8h5M6 11h5" />
    </>
  ),
  percent: (
    <>
      <path d="M4 12L12 4" />
      <circle cx="4.5" cy="4.5" r="1.8" />
      <circle cx="11.5" cy="11.5" r="1.8" />
    </>
  ),
  tag: (
    <>
      <path d="M8.5 2H13a1 1 0 0 1 1 1v4.5L8 13.5 2.5 8z" />
      <circle cx="11" cy="5" r="1" />
    </>
  ),
  trend: (
    <>
      <path d="M2 13l4-4 3 2 5-6" />
      <path d="M11 5h3v3" />
    </>
  ),
  scales: (
    <>
      <path d="M8 2v12M4 14h8" />
      <path d="M3 5h10" />
      <path d="M3 5l-1.5 4h3z M13 5l-1.5 4h3z" />
    </>
  ),
  flow: <path d="M3 5h9l-2-2M13 11H4l2 2" />,
  target: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" />
    </>
  ),
  lines: <path d="M3 4h10M3 8h10M3 12h6" />,
  sliders: (
    <>
      <path d="M3 4h6M12 4h1M3 12h1M7 12h6M3 8h2M8 8h5" />
      <circle cx="10.5" cy="4" r="1.5" />
      <circle cx="5.5" cy="12" r="1.5" />
      <circle cx="6.5" cy="8" r="1.5" />
    </>
  ),
};

export function TabIcon({ name, small }: { name: TabIconName; small?: boolean }) {
  const s = small ? 14 : 16;
  return (
    <svg
      viewBox="0 0 16 16"
      width={s}
      height={s}
      aria-hidden="true"
      style={{ flex: `0 0 ${s}px` }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

export interface MainTab {
  value: string;
  label: string;
  icon: TabIconName;
  /** Small count pill after the label. */
  count?: number;
  /** A 1px divider is drawn before this tab. */
  dividerBefore?: boolean;
}

export function MainTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: MainTab[];
  value: string;
  onChange: (value: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  // On a narrow screen the bar scrolls inside itself; bring the active tab in.
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={barRef}
      role="tablist"
      className="mx-3 flex gap-1 overflow-x-auto rounded-[10px] border border-[#E3E8F0] bg-[#F1F4F9] p-[5px]"
    >
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <div key={t.value} className="contents">
            {t.dividerBefore && <span className="my-2 mx-[3px] w-px shrink-0 bg-[#DDE3EC]" />}
            <button
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.value)}
              className={`flex h-[38px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[7px] px-[14px] text-[13px] font-medium ${
                on
                  ? "bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(15,23,42,.10)] ring-1 ring-accent-dark"
                  : "text-[#5B6576] hover:bg-[#E6EBF3] hover:text-[#0F1B33]"
              }`}
            >
              <TabIcon name={t.icon} />
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold ${
                    on ? "bg-black/12 text-accent-foreground" : "bg-[#E6EBF3] text-[#8A93A0]"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export interface SubTab {
  value: string;
  label: string;
  icon: TabIconName;
  /** Status dot: grey for "no data", amber for "something is blocked". */
  dot?: "grey" | "amber";
  dotTitle?: string;
  /** Count pill, hidden when zero or undefined. */
  count?: number;
}

export function SubTabRow({
  tabs,
  value,
  onChange,
  meta,
}: {
  tabs: SubTab[];
  value: string;
  onChange: (value: string) => void;
  /** Context line, shown on the right. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-3.5 border-y border-[#EAECEF] bg-[#FBFCFE] px-[18px] py-3">
      <nav role="tablist" className="inline-flex gap-0.5 rounded-[9px] border border-[#DCE3EF] bg-white p-[3px]">
        {tabs.map((t) => {
          const on = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.value)}
              className={`flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-[12.5px] font-medium ${
                on
                  ? "bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--accent-dark)]"
                  : "text-[#5B6576] hover:bg-[#F1F4F9] hover:text-[#0F1B33]"
              }`}
            >
              <TabIcon name={t.icon} small />
              {t.label}
              {t.dot && (
                <span
                  title={t.dotTitle}
                  className={`h-[6px] w-[6px] rounded-full ${
                    on
                      ? "bg-black ring-1 ring-white"
                      : t.dot === "amber"
                        ? "bg-[#B45309]"
                        : "bg-[#D5DAE1]"
                  }`}
                />
              )}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold ${
                    on ? "bg-black text-white" : "bg-[#E6EBF3] text-[#5B6576]"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {meta && (
        <div className="ml-auto flex flex-wrap gap-3.5 text-[11.5px] text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
  );
}

/** A value inside the context line, in ink. */
export function MetaValue({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-[#0F1B33]">{children}</b>;
}

export function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-2.5 pb-1 pt-4">
      <h3 className="m-0 text-[15px] font-bold text-[#0F1B33]">{title}</h3>
      <span className="text-[12px] text-muted-foreground">{sub}</span>
    </div>
  );
}
