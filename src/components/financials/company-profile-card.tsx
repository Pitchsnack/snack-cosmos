import type { StartupFinancials } from "@/lib/financials.functions";
import { fmtCapital } from "@/lib/financials";
import { FinIcon } from "./fin-icon";
const NAVY = "var(--foreground)";
const BLUE = "var(--link)";
const DASH = "–";
export function CompanyProfileCard({
  data,
  years,
  activeYear,
  onSelectYear,
}: {
  data: StartupFinancials;
  years: number[];
  activeYear: number | undefined;
  onSelectYear: (year: number) => void;
}) {
  const p = data.profile;
  const statusText = (p.status ?? "").toLowerCase();
  const operating =
    statusText === "active" ||
    statusText === "operating" ||
    p.status === "ยังดำเนินกิจการอยู่";
  const rows: [string, string, boolean?][][] = [
    [
      ["Registered Type", p.registeredType ?? DASH],
      ["Status", p.status ?? DASH, true],
      ["Registered Date", p.registeredDate ?? DASH],
    ],
    [
      ["Registered Capital", fmtCapital(p.registeredCapital) ?? DASH],
      ["Last Registered ID", p.registeredNumber ?? DASH],
      ["Business Size", p.businessSize ?? DASH],
    ],
  ];

  return (
    <div className="rounded-[13px] border border-[#E5E7EB] bg-white px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#EAF1FD]" style={{ color: NAVY }}>
          {data.logoUrl ? (
            <img
              src={data.logoUrl}
              alt={`${data.startupName} logo`}
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <FinIcon name="building" className="h-[21px] w-[21px]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {/* Registered names exactly as filed: Thai at title size, English
              beside it in smaller grey letters, wrapping as a whole. */}
          <div className="mb-3 flex flex-wrap items-baseline gap-x-[10px] border-b border-[#EFF1F4] pb-2">
            <span className="text-[15.5px] font-bold" style={{ color: "#151A28" }}>
              {data.legalNameTh || data.registeredName || data.startupName}
            </span>
            {data.legalNameEn ? (
              <span className="text-[14px] font-medium" style={{ color: "#6A7181" }}>
                {data.legalNameEn}
              </span>
            ) : null}
          </div>
          <div className="grid gap-y-2 gap-x-7 md:[grid-template-columns:1fr_1fr_1.15fr]">
            {rows.map((col, i) => (
              <div key={i} className="grid [align-content:start] gap-x-[18px] gap-y-1.5 [grid-template-columns:auto_1fr]">
                {col.map(([k, v, isStatus]) => (
                  <div key={k} className="contents">
                    <div className="whitespace-nowrap py-0.5 text-[12.5px] font-semibold text-[#0F1B33]">{k}</div>
                    <div
                      className="py-0.5 text-[12.5px] text-[#374151]"
                      style={isStatus && v !== DASH ? { color: operating ? "#16A34A" : "#EA8A0B", fontWeight: 600 } : undefined}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div>
              <div className="mb-1.5 text-[12.5px] font-semibold text-[#0F1B33]">
                Fiscal Year (submitted financial statement)
              </div>
              <div className="mb-1 flex flex-wrap gap-x-3.5 gap-y-1">
                {years.length === 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">{DASH}</span>
                ) : (
                  [...years]
                    .sort((a, b) => b - a)
                    .map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => onSelectYear(y)}
                        className={`text-[12.5px] ${y === activeYear ? "font-bold underline" : "font-medium"}`}
                        style={{ color: BLUE }}
                      >
                        {y}
                      </button>
                    ))
                )}
              </div>
              <div className="text-[11.5px] text-muted-foreground">(click to display financial statements)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

