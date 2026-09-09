/**
 * Company Info tab — PitchSnack registry profile.
 *
 * Presentation follows the redesigned target-company profile: no shadows, no
 * gradients, one filled crimson action, Thai text first with English glosses
 * beneath. Every value comes from the stored DBD record or the filed
 * statements — nothing is invented and empty values read "Not on file".
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ExternalLink,
  Info,
  Pencil,
} from "lucide-react";

import { formatThaiDateTime, type CompanyInfoTh } from "@/lib/company-info";
import type { StartupFinancials, StatementItem } from "@/lib/financials.functions";
import { fmtCapital } from "@/lib/financials";
import { CompanyInfoEditor } from "@/components/financials/company-info-editor";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const C = {
  ink: "#1A1F2B",
  ink2: "#3C4353",
  grey: "#636C80",
  grey2: "#8B93A5",
  crimson: "#A6323C",
  crimson2: "#8E2A33",
  crimsonbg: "#F6E9EA",
  sage: "#3E7D6D",
  sage2: "#2F6555",
  sagebg: "#E8F1EE",
  blue: "#2B6F9E",
  line: "#E3E6EB",
  line2: "#EEF0F3",
  fill: "#F7F8FA",
  fill2: "#EEF0F3",
} as const;

const FONT =
  '"IBM Plex Sans", "IBM Plex Sans Thai Looped", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

const NOT_ON_FILE = "Not on file";

function Eyebrow({ children, color = C.grey }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="uppercase"
      style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", lineHeight: "16px", color }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-white ${className}`}
      style={{ borderColor: C.line, ...style }}
    >
      {children}
    </div>
  );
}

function Value({ text, mono = false }: { text: string | null; mono?: boolean }) {
  if (!text || !text.trim())
    return <span style={{ color: C.grey2 }}>{NOT_ON_FILE}</span>;
  return (
    <span
      className="th whitespace-pre-line"
      style={{ color: C.ink, ...(mono ? { fontFamily: MONO } : {}) }}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MILLION = 1_000_000;

const fmt = (v: number | null, digits = 1) =>
  v === null || Number.isNaN(v)
    ? null
    : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const compactBaht = (v: number | null) => {
  if (v === null) return null;
  if (Math.abs(v) >= 1_000_000_000) return `฿${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= MILLION) return `฿${(v / MILLION).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `฿${(v / 1000).toFixed(1)}K`;
  return `฿${v.toFixed(0)}`;
};

const pick = (items: StatementItem[], code: string, year: number): number | null =>
  items.find((i) => i.item_code === code && i.fiscal_year === year)?.amount ?? null;

const parseNumber = (raw: string | null): number | null => {
  if (!raw) return null;
  const m = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Extracts a four-digit year from a Thai (BE) or Latin (CE) date string. */
const yearFromRaw = (raw: string | null): number | null => {
  if (!raw) return null;
  const m = raw.match(/(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y > 2400 ? y - 543 : y;
};

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export function CompanyInfoTab({
  startupId,
  info,
  financials,
  canManage,
  onSaved,
  workspace = "startups",
}: {
  startupId: string;
  info: CompanyInfoTh;
  financials?: StartupFinancials;
  canManage: boolean;
  onSaved: () => void;
  workspace?: "startups" | "my-startups";
}) {
  const [editing, setEditing] = useState(false);

  const years = useMemo(
    () => [...(financials?.years ?? [])].sort((a, b) => a - b).slice(-5),
    [financials?.years],
  );

  const snapshot = useMemo(() => {
    if (!financials || years.length === 0) return null;
    const income = financials.income;
    const position = financials.position;
    const series = (getter: (y: number) => number | null) => years.map(getter);

    const revenue = series((y) => pick(income, "total_revenue", y) ?? pick(income, "revenue_sales_services", y));
    const netProfit = series((y) => pick(income, "net_profit_loss", y));
    const assets = series((y) => pick(position, "total_assets", y));
    const equity = series((y) => pick(position, "equity", y));
    const margin = revenue.map((r, i) =>
      r && r !== 0 && netProfit[i] !== null ? ((netProfit[i] as number) / r) * 100 : null,
    );
    return { revenue, netProfit, assets, equity, margin };
  }, [financials, years]);

  const signatoryText = info.authorizedSignatoryTh ?? "";
  const directors = info.directors;
  const signatories = directors.filter(
    (d) => d.nameTh.trim() && signatoryText.includes(d.nameTh.trim()),
  );

  const capital = parseNumber(info.registeredCapitalThRaw);
  const registeredYear = yearFromRaw(info.registrationDateThRaw);
  const yearsOperating =
    registeredYear !== null ? new Date().getFullYear() - registeredYear : null;
  const filingYears = info.submissionYearsBe.map((be) => be - 543).sort((a, b) => a - b);
  const tsic = info.latestBusiness.code ?? info.registeredBusiness.code ?? null;

  const objectiveChanged = Boolean(
    info.registeredBusiness.objectiveTh &&
      info.latestBusiness.objectiveTh &&
      info.registeredBusiness.objectiveTh.trim() !== info.latestBusiness.objectiveTh.trim(),
  );
  const sameCode = Boolean(
    info.registeredBusiness.code &&
      info.latestBusiness.code &&
      info.registeredBusiness.code === info.latestBusiness.code,
  );

  const financialsLink = workspace === "my-startups" ? "/my-startups" : "/startups";

  if (editing) {
    return (
      <div style={{ fontFamily: FONT, fontFeatureSettings: '"tnum"' }}>
        <CompanyInfoEditor
          startupId={startupId}
          info={info}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
        />
      </div>
    );
  }

  /* ---------------- glance tiles ---------------- */
  const tiles: { label: string; value: string; caption: string }[] = [
    {
      label: "Registered capital",
      value: compactBaht(capital) ?? NOT_ON_FILE,
      caption: fmtCapital(info.registeredCapitalThRaw) ?? NOT_ON_FILE,
    },
    {
      label: "Business size",
      value: info.businessSize ?? NOT_ON_FILE,
      caption: info.businessSize ? `Classification “${info.businessSize}”` : NOT_ON_FILE,
    },
    {
      label: "Years operating",
      value: yearsOperating !== null ? String(yearsOperating) : NOT_ON_FILE,
      caption: info.registrationDateThRaw ? `Since ${info.registrationDateThRaw}` : NOT_ON_FILE,
    },
    {
      label: "Directors",
      value: directors.length ? String(directors.length) : NOT_ON_FILE,
      caption: `${signatories.length} authorised signator${signatories.length === 1 ? "y" : "ies"}`,
    },
    {
      label: "Filings on record",
      value: filingYears.length ? `${filingYears.length} years` : NOT_ON_FILE,
      caption: filingYears.length
        ? `FY${filingYears[0]} – FY${filingYears[filingYears.length - 1]}`
        : NOT_ON_FILE,
    },
    {
      label: "Industry",
      value: tsic ? `TSIC ${tsic}` : NOT_ON_FILE,
      caption: info.businessGroupTh ?? NOT_ON_FILE,
    },
  ];

  /* ---------------- screening notes ---------------- */
  const notes: { tone: "positive" | "attention" | "neutral"; title: string; caption: string }[] = [];
  if (filingYears.length)
    notes.push({
      tone: "positive",
      title: `Financial statements filed for ${filingYears.length} year${filingYears.length === 1 ? "" : "s"}`,
      caption: `FY${filingYears[0]} – FY${filingYears[filingYears.length - 1]}`,
    });
  if (objectiveChanged)
    notes.push({
      tone: "attention",
      title: "Stated objective differs from the one registered",
      caption: "Compare the registration and the latest filing below",
    });
  if (!info.website)
    notes.push({
      tone: "attention",
      title: "No website on record",
      caption: "Confirm the operating presence during outreach",
    });
  if (signatories.length)
    notes.push({
      tone: "neutral",
      title: "Signing authority is recorded",
      caption: `${signatories.length} of ${directors.length} directors are authorised signatories`,
    });

  return (
    <div
      className="th"
      style={{ fontFamily: FONT, fontFeatureSettings: '"tnum"', color: C.ink }}
    >
      {canManage && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-[34px] items-center gap-2 rounded-[7px] border bg-transparent px-3.5 text-[13px] font-600"
            style={{ borderColor: C.crimson, color: C.crimson, fontWeight: 600 }}
          >
            <Pencil size={14} strokeWidth={1.6} /> Edit registry record
          </button>
        </div>
      )}

      {/* AT A GLANCE */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="flex flex-col gap-1.5 px-[18px] py-4">
            <Eyebrow>{t.label}</Eyebrow>
            <div style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, color: C.ink }}>
              {t.value}
            </div>
            <div style={{ fontSize: 12, color: t.caption === NOT_ON_FILE ? C.grey2 : C.grey }}>
              {t.caption}
            </div>
          </Card>
        ))}
      </div>

      {/* TWO COLUMN */}
      <div className="mt-5 flex flex-col items-start gap-5 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* FINANCIAL SNAPSHOT */}
          {snapshot && (
            <Card className="flex flex-col gap-4 px-[22px] pb-[18px] pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>
                    Financial snapshot
                  </h3>
                  <div style={{ fontSize: 12, color: C.grey }}>
                    From the financial statements filed with DBD · FY{years[0]} – FY
                    {years[years.length - 1]} · THB million
                  </div>
                </div>
                <Link
                  to={`${financialsLink}/$id/financials` as never}
                  params={{ id: startupId } as never}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium hover:underline"
                  style={{ color: C.blue }}
                >
                  Open income statement <ArrowRight size={14} strokeWidth={1.6} />
                </Link>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <BarChart
                  title="Revenue"
                  years={years}
                  values={snapshot.revenue.map((v) => (v === null ? null : v / MILLION))}
                />
                <BarChart
                  title="Net profit"
                  years={years}
                  values={snapshot.netProfit.map((v) => (v === null ? null : v / MILLION))}
                />
              </div>

              <SnapshotTable
                years={years}
                rows={[
                  { label: "Revenue", values: snapshot.revenue.map(toM), percent: true },
                  { label: "Net profit", values: snapshot.netProfit.map(toM), percent: true },
                  { label: "Net margin", values: snapshot.margin, suffix: "%", pointChange: true },
                  { label: "Total assets", values: snapshot.assets.map(toM), percent: true },
                  { label: "Shareholders’ equity", values: snapshot.equity.map(toM), percent: true },
                ]}
              />
            </Card>
          )}

          {/* BUSINESS ACTIVITY */}
          <Card className="flex flex-col gap-[18px] px-[22px] py-5">
            <div className="flex flex-col gap-1">
              <h3 style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>
                Business activity
              </h3>
              <div style={{ fontSize: 12, color: C.grey }}>
                Thai text as registered with DBD
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="w-[150px] shrink-0 pt-[3px]">
                <Eyebrow>Industry (TSIC)</Eyebrow>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  {tsic ? (
                    <span
                      className="rounded-[5px] px-2 py-0.5"
                      style={{
                        fontFamily: MONO,
                        fontSize: 12,
                        fontWeight: 500,
                        background: C.fill2,
                        color: C.ink,
                      }}
                    >
                      {tsic}
                    </span>
                  ) : (
                    <span style={{ color: C.grey2, fontSize: 13 }}>{NOT_ON_FILE}</span>
                  )}
                  {sameCode && (
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 500, color: C.sage2 }}
                    >
                      <Check size={14} strokeWidth={1.6} />
                      Same code at registration and in the latest filing
                    </span>
                  )}
                </div>
                <div className="th" style={{ fontSize: 14, lineHeight: 1.65 }}>
                  <Value
                    text={
                      info.latestBusiness.descriptionTh ?? info.registeredBusiness.descriptionTh
                    }
                  />
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: C.line2 }} />

            <div className="flex items-start gap-5">
              <div className="w-[150px] shrink-0 pt-[3px]">
                <Eyebrow>Stated objective</Eyebrow>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {objectiveChanged && (
                  <span
                    className="inline-flex items-center gap-1.5 self-start rounded-full py-[3px] pl-2 pr-2.5"
                    style={{ background: C.crimsonbg, color: C.crimson2, fontSize: 12, fontWeight: 500 }}
                  >
                    <AlertCircle size={14} strokeWidth={1.6} /> Changed since registration
                  </span>
                )}
                <div className="grid gap-5 md:grid-cols-2">
                  <ObjectivePanel
                    eyebrow={`At registration${registeredYear ? ` · ${registeredYear}` : ""}`}
                    text={info.registeredBusiness.objectiveTh}
                  />
                  <ObjectivePanel
                    eyebrow={`Latest filing${
                      info.latestBusiness.financialYearBe
                        ? ` · FY${info.latestBusiness.financialYearBe - 543}`
                        : ""
                    }`}
                    text={info.latestBusiness.objectiveTh}
                    ringed
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* REGISTRATION RECORD */}
          <Card className="flex flex-col gap-4 px-[22px] py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>
                  Registration record
                </h3>
                <div style={{ fontSize: 12, color: C.grey }}>
                  As recorded by the Department of Business Development
                </div>
              </div>
              {info.sourceUrl && (
                <a
                  href={info.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium hover:underline"
                  style={{ color: C.blue }}
                >
                  Open DBD record <ExternalLink size={14} strokeWidth={1.6} />
                </a>
              )}
            </div>
            <div className="grid gap-x-10 md:grid-cols-2">
              <div>
                <RecRow label="Registered name" value={info.legalNameTh} />
                <RecRow label="Registration no." value={info.registrationNumber} mono />
                <RecRow label="Juristic type" value={info.legalEntityTypeTh} />
                <RecRow label="Status" value={info.legalEntityStatusTh} last />
              </div>
              <div>
                <RecRow label="Registered date" value={info.registrationDateThRaw} />
                <RecRow label="Registered capital" value={fmtCapital(info.registeredCapitalThRaw)} />
                <RecRow label="Business size" value={info.businessSize} />
                <RecRow label="Last registered ID" value={info.previousRegistrationNumber} mono />
                <RecRow label="Head office" value={info.headOfficeAddressTh} />
                <RecRow label="Website" value={info.website} last />
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT RAIL */}
        <div className="flex w-full shrink-0 flex-col gap-5 xl:w-[400px]">
          {notes.length > 0 && (
            <Card className="flex flex-col gap-3.5 px-[22px] py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>
                    Screening notes
                  </h3>
                  <div style={{ fontSize: 12, color: C.grey }}>
                    Read from the registry record before any offer
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5"
                  style={{ background: C.fill2, fontSize: 11, fontWeight: 600, color: C.ink2 }}
                >
                  {notes.length} signal{notes.length === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                {notes.map((n, i) => (
                  <div
                    key={n.title}
                    className="flex items-start gap-3 py-2.5"
                    style={{
                      borderBottom: i === notes.length - 1 ? "none" : `1px solid ${C.line2}`,
                    }}
                  >
                    <span
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                      style={{
                        background:
                          n.tone === "positive"
                            ? C.sagebg
                            : n.tone === "attention"
                              ? C.crimsonbg
                              : C.fill2,
                        color:
                          n.tone === "positive"
                            ? C.sage2
                            : n.tone === "attention"
                              ? C.crimson2
                              : C.ink2,
                      }}
                    >
                      {n.tone === "positive" ? (
                        <Check size={13} strokeWidth={2} />
                      ) : n.tone === "attention" ? (
                        <AlertCircle size={13} strokeWidth={2} />
                      ) : (
                        <Info size={13} strokeWidth={2} />
                      )}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div style={{ fontSize: 13, lineHeight: "18px", fontWeight: 500 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: "16px", color: C.grey }}>
                        {n.caption}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, lineHeight: "14px", color: C.grey2 }}>
                Decision support, not advice.
              </div>
            </Card>
          )}

          {/* DIRECTORS */}
          <Card className="flex flex-col gap-3 px-[22px] py-5">
            <div className="flex items-center gap-2">
              <h3 style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>Directors</h3>
              <span
                className="rounded-full px-2 py-0.5"
                style={{ background: C.fill2, fontSize: 11, fontWeight: 600, color: C.ink2 }}
              >
                {directors.length}
              </span>
            </div>
            {directors.length === 0 ? (
              <div style={{ fontSize: 13, color: C.grey2 }}>{NOT_ON_FILE}</div>
            ) : (
              <div>
                {directors.map((d, i) => (
                  <div
                    key={d.id ?? i}
                    className="flex items-center gap-3 py-[9px]"
                    style={{
                      borderBottom: i === directors.length - 1 ? "none" : `1px solid ${C.line2}`,
                    }}
                  >
                    <span
                      className="w-[18px] shrink-0"
                      style={{ fontFamily: MONO, fontSize: 12, color: C.grey2 }}
                    >
                      {i + 1}
                    </span>
                    <span className="th min-w-0 flex-1" style={{ fontSize: 14, lineHeight: 1.65 }}>
                      {d.nameTh}
                    </span>
                    {signatoryText.includes(d.nameTh.trim()) && (
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5"
                        style={{
                          borderColor: C.crimson,
                          color: C.crimson,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Signatory
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {info.authorizedSignatoryTh && (
              <div
                className="flex flex-col gap-1.5 rounded-[8px] px-3.5 py-3"
                style={{ background: C.fill }}
              >
                <Eyebrow>Signing authority</Eyebrow>
                <div className="th" style={{ fontSize: 12, lineHeight: 1.65, color: C.grey }}>
                  {info.authorizedSignatoryTh}
                </div>
              </div>
            )}
          </Card>

          {/* FILINGS */}
          <Card className="flex flex-col gap-2.5 px-[22px] py-5">
            <div className="flex items-center justify-between gap-3">
              <h3 style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>Filings</h3>
            </div>
            {filingYears.length === 0 ? (
              <div style={{ fontSize: 13, color: C.grey2 }}>{NOT_ON_FILE}</div>
            ) : (
              <div>
                {[...filingYears].reverse().map((y, i, arr) => (
                  <div
                    key={y}
                    className="flex items-center gap-3 py-[9px]"
                    style={{ borderBottom: i === arr.length - 1 ? "none" : `1px solid ${C.line2}` }}
                  >
                    <span className="w-[56px] shrink-0" style={{ fontSize: 13, fontWeight: 600 }}>
                      FY{y}
                    </span>
                    <span className="flex-1" style={{ fontSize: 13, color: C.ink2 }}>
                      Financial statements
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 500, color: C.sage2 }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: C.sage }}
                      />
                      Filed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* FOOTER */}
      <div
        className="mt-5 flex flex-wrap items-center justify-between gap-6 pt-4"
        style={{ borderTop: `1px solid ${C.line}`, fontSize: 12, lineHeight: "16px", color: C.grey }}
      >
        <span>
          Source: {info.sourceName ?? "DBD Data Warehouse"}
          {formatThaiDateTime(info.retrievedAt) ? ` · Last updated ${formatThaiDateTime(info.retrievedAt)}` : ""}
          {info.manuallyEditedAt
            ? ` · Manually edited ${formatThaiDateTime(info.manuallyEditedAt)}`
            : ""}
        </span>
        <span className="text-right">
          Auto-enriched fields come from external sources and may change. Verify with DBD before
          relying on them.
        </span>
      </div>
    </div>
  );
}

const toM = (v: number | null) => (v === null ? null : v / MILLION);

function ObjectivePanel({
  eyebrow,
  text,
  ringed = false,
}: {
  eyebrow: string;
  text: string | null;
  ringed?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-[8px] px-4 py-3.5"
      style={{
        background: C.fill,
        ...(ringed ? { boxShadow: `inset 0 0 0 1px ${C.line}` } : {}),
      }}
    >
      <Eyebrow color={C.grey2}>{eyebrow}</Eyebrow>
      <div className="th" style={{ fontSize: 14, lineHeight: 1.65 }}>
        <Value text={text} />
      </div>
    </div>
  );
}

function RecRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-baseline gap-4 py-2.5"
      style={{ borderBottom: last ? "none" : `1px solid ${C.line2}` }}
    >
      <div className="w-[150px] shrink-0" style={{ fontSize: 13, color: C.grey }}>
        {label}
      </div>
      <div className="min-w-0 flex-1" style={{ fontSize: 14, lineHeight: "23px" }}>
        <Value text={value} mono={mono} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts and table                                                    */
/* ------------------------------------------------------------------ */

function BarChart({
  title,
  years,
  values,
}: {
  title: string;
  years: number[];
  values: (number | null)[];
}) {
  const max = Math.max(...values.map((v) => (v === null ? 0 : Math.abs(v))), 1);
  const width = 380;
  const slot = width / Math.max(values.length, 1);
  const barW = Math.min(44, slot * 0.6);

  return (
    <div className="flex flex-col gap-2">
      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: "16px", color: C.ink }}>{title}</div>
      <svg viewBox="0 0 380 124" width="100%" height={124} className="block overflow-visible">
        <line x1={0} y1={100} x2={380} y2={100} stroke={C.line} strokeWidth={1} />
        {values.map((v, i) => {
          const cx = slot * i + slot / 2;
          const left = cx - barW / 2;
          const h = v === null ? 0 : (Math.abs(v) / max) * 74;
          const top = 100 - Math.max(h, v === null ? 0 : 2);
          const first = i === 0;
          const lastBar = i === values.length - 1;
          return (
            <g key={i}>
              {v !== null && (
                <path
                  d={`M${left} 100 V${top + 4} a4 4 0 0 1 4 -4 h${barW - 8} a4 4 0 0 1 4 4 V100 Z`}
                  fill={C.blue}
                />
              )}
              {(first || lastBar) && v !== null && (
                <text
                  x={cx}
                  y={top - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={lastBar ? 600 : 400}
                  fill={lastBar ? C.ink : C.grey}
                >
                  {fmt(v, Math.abs(v) >= 100 ? 0 : 1)}
                </text>
              )}
              <text x={cx} y={118} textAnchor="middle" fontSize={11} fill={C.grey}>
                FY{String(years[i]).slice(-2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SnapshotTable({
  years,
  rows,
}: {
  years: number[];
  rows: {
    label: string;
    values: (number | null)[];
    suffix?: string;
    percent?: boolean;
    pointChange?: boolean;
  }[];
}) {
  const th: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: C.grey,
    padding: "0 0 8px 0",
    borderBottom: `1px solid ${C.line}`,
    textAlign: "right",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left", width: "34%" }}>THB million</th>
            {years.map((y) => (
              <th key={y} style={th}>
                FY{y}
              </th>
            ))}
            <th style={{ ...th, width: "11%" }}>YoY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const last = r.values[r.values.length - 1];
            const prev = r.values[r.values.length - 2] ?? null;
            let yoy: string | null = null;
            if (last !== null && prev !== null && prev !== 0) {
              yoy = r.pointChange
                ? `${last - prev >= 0 ? "+" : ""}${(last - prev).toFixed(1)} pt`
                : `${last - prev >= 0 ? "+" : ""}${(((last - prev) / Math.abs(prev)) * 100).toFixed(1)}%`;
            }
            const border = ri === rows.length - 1 ? "none" : `1px solid ${C.line2}`;
            return (
              <tr key={r.label}>
                <td
                  style={{
                    fontSize: 13,
                    lineHeight: "18px",
                    color: C.ink2,
                    padding: "9px 0",
                    borderBottom: border,
                  }}
                >
                  {r.label}
                </td>
                {r.values.map((v, i) => (
                  <td
                    key={i}
                    style={{
                      fontSize: 13,
                      lineHeight: "18px",
                      color: v === null ? C.grey2 : C.ink,
                      fontWeight: i === r.values.length - 1 ? 600 : 400,
                      textAlign: "right",
                      padding: "9px 0",
                      borderBottom: border,
                    }}
                  >
                    {v === null ? "—" : `${fmt(v)}${r.suffix ?? ""}`}
                  </td>
                ))}
                <td
                  style={{
                    fontSize: 13,
                    lineHeight: "18px",
                    color: yoy ? C.sage2 : C.grey2,
                    fontWeight: 500,
                    textAlign: "right",
                    padding: "9px 0",
                    borderBottom: border,
                  }}
                >
                  {yoy ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
